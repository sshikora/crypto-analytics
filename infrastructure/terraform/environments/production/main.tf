terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
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

  project_name    = var.project_name
  environment     = var.environment
  domain_name     = var.domain_name
  route53_zone_id = module.route53.zone_id
  callback_urls   = ["https://${var.domain_name}", "https://${var.domain_name}/callback", "http://localhost:5173", "http://localhost:5173/callback"]
  logout_urls     = ["https://${var.domain_name}", "http://localhost:5173"]
}

# Email Module (AWS SES + Google Workspace DNS)
module "email" {
  source = "../../modules/email"

  domain_name       = var.domain_name
  environment       = var.environment
  route53_zone_id   = module.route53.zone_id
  google_dkim_value = var.google_dkim_value
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
  api_alias_target = {
    dns_name = module.api_cdn.distribution_domain_name
    zone_id  = module.api_cdn.distribution_hosted_zone_id
  }

  cloudfront_only            = true
  origin_verify_header_name  = module.api_cdn.origin_verify_header_name
  origin_verify_header_value = module.api_cdn.origin_verify_header_value
  reject_unverified_requests = true
  initial_image              = "010151257830.dkr.ecr.us-east-1.amazonaws.com/crypto-analytics-backend:latest"
  cpu                        = 256
  memory                     = 512

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
    COGNITO_CLIENT_ID                 = module.cognito.user_pool_client_id
    DOMAIN_NAME                       = var.domain_name
    EMAIL_FROM_NAME                   = "Crypto Quant Lab"
    # Only one copy of the checker may run at a time; the service runs a single task.
    ENABLE_CROSSOVER_CHECKER = "true"
    # CloudFront and the ALB both sit in front of the app.
    TRUST_PROXY_HOPS = "2"
  }

  secret_names = ["COINGECKO_API_KEY"]

  task_role_policy_arns = [
    module.cognito.dynamodb_access_policy_arn,
    module.email.ses_send_email_policy_arn,
  ]
}

# CloudFront and WAF in front of the API load balancer
module "api_cdn" {
  source = "../../modules/api_cdn"

  project_name       = var.project_name
  environment        = var.environment
  api_domain_name    = "api.${var.domain_name}"
  origin_domain_name = "api-origin.${var.domain_name}"
  alb_dns_name       = module.backend_service.alb_dns_name
  alb_zone_id        = module.backend_service.alb_zone_id
  certificate_arn    = module.route53.certificate_arn
  route53_zone_id    = module.route53.zone_id
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

  deploy_runs_url = "https://github.com/sshikora/crypto-analytics/actions/workflows/deploy.yml"

  health_check_urls = {
    site = {
      fqdn   = var.domain_name
      path   = "/"
      impact = "Visitors can't load the site."
      checks = <<-EOT
        2. The site is served from S3 through CloudFront. If the latest deploy's "Publish frontend" step failed, re-run that deploy: https://github.com/sshikora/crypto-analytics/actions/workflows/deploy.yml
        3. Otherwise check CloudFront and S3 on https://health.aws.amazon.com/health/status
      EOT
    }
    api = {
      fqdn   = "api.${var.domain_name}"
      path   = "/health"
      impact = "The site loads but can't fetch any data."
      checks = <<-EOT
        2. If the no-healthy-targets alarm also fired, the backend is down; follow that alarm's steps.
        3. If not, the backend is fine and something in front of it is failing: CloudFront, the WAF, DNS or the certificate. Run curl -sv https://api.${var.domain_name}/health and look at the status and error.
      EOT
    }
  }
}

# Stored market data
module "data" {
  source = "../../modules/data"

  project_name = var.project_name
  environment  = var.environment
}

# Batch jobs on a schedule, run from the backend image
module "scheduled_jobs" {
  source = "../../modules/scheduled_jobs"

  project_name       = var.project_name
  environment        = var.environment
  cluster_arn        = module.backend_service.cluster_arn
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.public_subnet_ids
  image              = "${module.backend_service.ecr_repository_url}:latest"
  execution_role_arn = module.backend_service.execution_role_arn
  alarm_topic_arn    = module.monitoring.alerts_topic_arn

  task_role_policy_arns = [module.data.price_history_write_policy_arn]

  environment_variables = {
    NODE_ENV                     = "production"
    AWS_REGION                   = var.aws_region
    DYNAMODB_PRICE_HISTORY_TABLE = module.data.price_history_table_name
  }

  secrets = {
    COINGECKO_API_KEY = module.backend_service.secret_parameter_arns["COINGECKO_API_KEY"]
  }

  jobs = {
    "ingest-prices" = {
      # CoinGecko publishes the midnight UTC snapshot shortly after midnight.
      schedule          = "cron(30 0 * * ? *)"
      command           = ["node", "dist/jobs/cli.js", "ingest-prices"]
      max_silence_hours = 26
      about             = "It runs at 00:30 UTC and saves daily prices for the top 100 coins. Each run re-fetches 3 days, so one or two missed nights fill themselves in."
    }
  }
}
