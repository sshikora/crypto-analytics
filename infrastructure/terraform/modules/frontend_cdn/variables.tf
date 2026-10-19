variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aliases" {
  description = "Domain names served by the distribution"
  type        = list(string)
}

variable "certificate_arn" {
  description = "ACM certificate ARN in us-east-1 covering the aliases"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for the aliases"
  type        = string
}

variable "manage_dns" {
  description = "Point the aliases at the distribution"
  type        = bool
  default     = false
}
