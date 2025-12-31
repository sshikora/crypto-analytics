variable "domain_name" {
  description = "The domain name for email (e.g., cryptoquantlab.com)"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for DNS records"
  type        = string
}

variable "eks_node_role_name" {
  description = "Name of the EKS node IAM role (for SES permissions)"
  type        = string
}

variable "google_dkim_value" {
  description = "Google Workspace DKIM TXT record value (get from Google admin console)"
  type        = string
  default     = ""
}
