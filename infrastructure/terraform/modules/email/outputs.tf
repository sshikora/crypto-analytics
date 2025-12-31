output "ses_domain_identity_arn" {
  description = "ARN of the SES domain identity"
  value       = aws_ses_domain_identity.main.arn
}

output "ses_domain_identity_verification_token" {
  description = "Verification token for SES domain"
  value       = aws_ses_domain_identity.main.verification_token
}

output "ses_dkim_tokens" {
  description = "DKIM tokens for SES"
  value       = aws_ses_domain_dkim.main.dkim_tokens
}

output "ses_send_email_policy_arn" {
  description = "ARN of the IAM policy for sending email via SES"
  value       = aws_iam_policy.ses_send_email.arn
}

output "noreply_email" {
  description = "Noreply email address for sending transactional emails"
  value       = aws_ses_email_identity.noreply.email
}
