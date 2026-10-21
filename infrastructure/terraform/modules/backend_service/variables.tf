variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnets for the ALB and tasks"
  type        = list(string)
}

variable "certificate_arn" {
  description = "ACM certificate ARN covering the API domain"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for the API domain"
  type        = string
}

variable "api_domain_name" {
  description = "Domain name served by the backend ALB"
  type        = string
}

variable "manage_dns" {
  description = "Manage the API domain's DNS records"
  type        = bool
  default     = false
}

variable "cloudfront_only" {
  description = "Accept HTTPS connections to the ALB only from CloudFront origin-facing addresses"
  type        = bool
  default     = false
}

variable "origin_verify_header_name" {
  description = "Header that marks requests as coming from this project's CloudFront distribution"
  type        = string
  default     = null
}

variable "origin_verify_header_value" {
  description = "Secret value of the origin verify header"
  type        = string
  default     = null
  sensitive   = true
}

variable "reject_unverified_requests" {
  description = "Return 403 for requests that lack the origin verify header"
  type        = bool
  default     = false
}

variable "api_alias_target" {
  description = "Alias target for the API domain, such as a CloudFront distribution; null points it at the ALB"
  type = object({
    dns_name = string
    zone_id  = string
  })
  default = null
}

variable "initial_image" {
  description = "Image for the Terraform-managed task definition; deploys replace it"
  type        = string
}

variable "container_port" {
  description = "Port the backend listens on"
  type        = number
  default     = 4000
}

variable "cpu" {
  description = "Task CPU units"
  type        = number
  default     = 512
}

variable "memory" {
  description = "Task memory in MiB"
  type        = number
  default     = 1024
}

variable "ecr_images_to_keep" {
  description = "Number of most recent backend images kept in ECR"
  type        = number
  default     = 20
}

variable "environment_variables" {
  description = "Plain environment variables for the container"
  type        = map(string)
}

variable "secret_names" {
  description = "Environment variables injected from SSM SecureString parameters"
  type        = list(string)
}

variable "task_role_policy_arns" {
  description = "IAM policies granting the backend access to AWS services"
  type        = list(string)
}
