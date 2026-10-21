output "distribution_id" {
  description = "CloudFront distribution ID for the API"
  value       = aws_cloudfront_distribution.api.id
}

output "distribution_domain_name" {
  description = "CloudFront domain name for the API"
  value       = aws_cloudfront_distribution.api.domain_name
}

output "distribution_hosted_zone_id" {
  description = "Route53 zone ID to use when aliasing to the distribution"
  value       = aws_cloudfront_distribution.api.hosted_zone_id
}

output "origin_verify_header" {
  description = "Header name and secret value CloudFront sends to the ALB"
  value = {
    name  = var.origin_verify_header_name
    value = random_password.origin_verify.result
  }
  sensitive = true
}
