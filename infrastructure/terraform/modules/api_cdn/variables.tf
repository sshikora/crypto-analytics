variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "api_domain_name" {
  description = "Public API domain served by CloudFront"
  type        = string
}

variable "origin_domain_name" {
  description = "Domain CloudFront uses to reach the ALB; must be covered by the ALB certificate"
  type        = string
}

variable "alb_dns_name" {
  description = "DNS name of the API load balancer"
  type        = string
}

variable "alb_zone_id" {
  description = "Hosted zone ID of the API load balancer"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN in us-east-1 covering the API domain"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for the domains"
  type        = string
}

variable "origin_verify_header_name" {
  description = "Header CloudFront adds to origin requests so the ALB can reject direct traffic"
  type        = string
  default     = "X-Origin-Verify"
}

variable "rate_limit_per_5_minutes" {
  description = "Requests per client IP per 5 minutes before WAF blocks it"
  type        = number
  default     = 300
}
