variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ARN suffix of the API load balancer"
  type        = string
}

variable "target_group_arn_suffix" {
  description = "ARN suffix of the backend target group"
  type        = string
}

variable "ecs_cluster_name" {
  description = "ECS cluster running the backend"
  type        = string
}

variable "ecs_service_name" {
  description = "ECS service running the backend"
  type        = string
}

variable "log_group_name" {
  description = "CloudWatch log group for the backend container"
  type        = string
}

variable "health_check_regions" {
  description = "Route53 health checker regions (minimum 3); fewer regions means fewer requests against CloudFront allowances"
  type        = list(string)
  default     = ["us-east-1", "us-west-2", "eu-west-1"]
}

variable "health_check_urls" {
  description = "Public HTTPS endpoints checked from outside AWS, keyed by short name"
  type = map(object({
    fqdn = string
    path = string
  }))
}
