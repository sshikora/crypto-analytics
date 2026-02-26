terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  backend "s3" {
    bucket         = "crypto-analytics-opentofu-state"
    key            = "production/opentofu.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "crypto-analytics-opentofu-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "production"
      Project     = "crypto-analytics"
      ManagedBy   = "opentofu"
    }
  }
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  private_subnets    = var.private_subnets
  public_subnets     = var.public_subnets
  single_nat_gateway = var.single_nat_gateway
}

# EKS Module
module "eks" {
  source = "../../modules/eks"

  project_name       = var.project_name
  environment        = var.environment
  cluster_version    = var.cluster_version
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids

  node_groups = var.node_groups
}

# Route53 Module
module "route53" {
  source = "../../modules/route53"

  domain_name = var.domain_name
  environment = var.environment
}

# Cognito Module for user authentication
module "cognito" {
  source = "../../modules/cognito"

  project_name     = var.project_name
  environment      = var.environment
  domain_name      = var.domain_name
  route53_zone_id  = module.route53.zone_id
  callback_urls    = ["https://${var.domain_name}", "https://${var.domain_name}/callback", "http://localhost:5173", "http://localhost:5173/callback"]
  logout_urls      = ["https://${var.domain_name}", "http://localhost:5173"]
}

# Attach DynamoDB access policy to EKS node group role so backend pods can access user preferences
resource "aws_iam_role_policy_attachment" "node_group_dynamodb" {
  policy_arn = module.cognito.dynamodb_access_policy_arn
  role       = module.eks.node_group_role_name
}

# Attach Cluster Autoscaler policy to EKS node group role
resource "aws_iam_role_policy_attachment" "node_group_cluster_autoscaler" {
  policy_arn = module.eks.cluster_autoscaler_policy_arn
  role       = module.eks.node_group_role_name
}

# Email Module (AWS SES + Google Workspace DNS)
module "email" {
  source = "../../modules/email"

  domain_name         = var.domain_name
  environment         = var.environment
  route53_zone_id     = module.route53.zone_id
  eks_node_role_name  = module.eks.node_group_role_name
  google_dkim_value   = var.google_dkim_value
}

# Configure Kubernetes provider
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.eks.cluster_name
    ]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        module.eks.cluster_name
      ]
    }
  }
}

# Install AWS Load Balancer Controller
resource "helm_release" "aws_load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"
  version    = "1.6.2"

  timeout = 600  # 10 minutes
  wait    = true

  set {
    name  = "clusterName"
    value = module.eks.cluster_name
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }

  depends_on = [module.eks]
}

# Install External DNS
# Note: Temporarily commented out due to IRSA configuration issues
# DNS records will be managed manually or through a separate deployment
# resource "helm_release" "external_dns" {
#   name       = "external-dns"
#   repository = "https://kubernetes-sigs.github.io/external-dns/"
#   chart      = "external-dns"
#   namespace  = "kube-system"
#   version    = "1.13.1"
#
#   timeout = 600  # 10 minutes
#
#   set {
#     name  = "serviceAccount.create"
#     value = "true"
#   }
#
#   set {
#     name  = "serviceAccount.name"
#     value = "external-dns"
#   }
#
#   set {
#     name  = "provider"
#     value = "aws"
#   }
#
#   set {
#     name  = "policy"
#     value = "sync"
#   }
#
#   set {
#     name  = "domainFilters[0]"
#     value = var.domain_name
#   }
#
#   depends_on = [
#     module.eks,
#     helm_release.aws_load_balancer_controller
#   ]
# }

# Install Cluster Autoscaler for automatic node scale-down
resource "helm_release" "cluster_autoscaler" {
  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  namespace  = "kube-system"
  version    = "9.43.0"

  timeout = 300
  wait    = true

  set {
    name  = "autoDiscovery.clusterName"
    value = module.eks.cluster_name
  }

  set {
    name  = "awsRegion"
    value = var.aws_region
  }

  set {
    name  = "extraArgs.balance-similar-node-groups"
    value = "true"
  }

  set {
    name  = "extraArgs.skip-nodes-with-system-pods"
    value = "false"
  }

  depends_on = [module.eks, aws_iam_role_policy_attachment.node_group_cluster_autoscaler]
}

# Install Cert Manager for SSL certificates
resource "helm_release" "cert_manager" {
  name       = "cert-manager"
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  namespace  = "cert-manager"
  version    = "v1.13.2"

  timeout = 600  # 10 minutes

  create_namespace = true

  set {
    name  = "installCRDs"
    value = "true"
  }

  depends_on = [module.eks]
}
