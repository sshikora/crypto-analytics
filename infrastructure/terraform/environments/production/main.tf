terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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
  public_subnets     = var.public_subnets
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

# Email Module (AWS SES + Google Workspace DNS)
module "email" {
  source = "../../modules/email"

  domain_name         = var.domain_name
  environment         = var.environment
  route53_zone_id     = module.route53.zone_id
  google_dkim_value   = var.google_dkim_value
}

# GitHub Actions OIDC roles for deploys and infrastructure changes
module "github_oidc" {
  source = "../../modules/github_oidc"

  project_name         = var.project_name
  environment          = var.environment
  github_repository    = "sshikora/crypto-analytics"
  ecr_repository_names = ["crypto-analytics-backend"]

  frontend_bucket_arn       = module.frontend_cdn.bucket_arn
  frontend_distribution_arn = module.frontend_cdn.distribution_arn

  ecs_service_arn       = module.backend_service.service_arn
  ecs_pass_role_arns    = module.backend_service.pass_role_arns
  secret_parameter_arns = values(module.backend_service.secret_parameter_arns)
}

# Backend API on ECS Fargate
module "backend_service" {
  source = "../../modules/backend_service"

  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  certificate_arn   = module.route53.certificate_arn
  route53_zone_id   = module.route53.zone_id
  api_domain_name   = "api.${var.domain_name}"
  manage_dns        = true
  initial_image     = "010151257830.dkr.ecr.us-east-1.amazonaws.com/crypto-analytics-backend:latest"

  environment_variables = {
    PORT                              = "4000"
    NODE_ENV                          = "production"
    AWS_REGION                        = var.aws_region
    DYNAMODB_PREFERENCES_TABLE        = module.cognito.dynamodb_table_name
    DYNAMODB_NOTIFICATION_RULES_TABLE = module.cognito.notification_rules_table_name
    DYNAMODB_NOTIFICATIONS_TABLE      = module.cognito.notifications_table_name
    DYNAMODB_EMAIL_RATE_LIMIT_TABLE   = module.cognito.email_rate_limits_table_name
    ALLOWED_ORIGINS                   = "https://${var.domain_name}"
    COGNITO_USER_POOL_ID              = module.cognito.user_pool_id
    DOMAIN_NAME                       = var.domain_name
    EMAIL_FROM_NAME                   = "Crypto Quant Lab"
    # Only one copy of the checker may run at a time; the service runs a single task.
    ENABLE_CROSSOVER_CHECKER = "true"
  }

  secret_names = ["API_KEY", "COINGECKO_API_KEY"]

  task_role_policy_arns = [
    module.cognito.dynamodb_access_policy_arn,
    module.email.ses_send_email_policy_arn,
  ]
}

# Static frontend on S3 + CloudFront
module "frontend_cdn" {
  source = "../../modules/frontend_cdn"

  project_name    = var.project_name
  environment     = var.environment
  aliases         = [var.domain_name, "www.${var.domain_name}"]
  certificate_arn = module.route53.certificate_arn
  route53_zone_id = module.route53.zone_id
  manage_dns      = true
}

# Alarms for the API, backend and public endpoints
module "monitoring" {
  source = "../../modules/monitoring"

  project_name            = var.project_name
  environment             = var.environment
  alb_arn_suffix          = module.backend_service.alb_arn_suffix
  target_group_arn_suffix = module.backend_service.target_group_arn_suffix
  ecs_cluster_name        = module.backend_service.cluster_name
  ecs_service_name        = module.backend_service.service_name
  log_group_name          = module.backend_service.log_group_name

  health_check_urls = {
    site = { fqdn = var.domain_name, path = "/" }
    api  = { fqdn = "api.${var.domain_name}", path = "/health" }
  }
}
