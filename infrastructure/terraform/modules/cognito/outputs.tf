output "user_pool_id" {
  description = "The ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "The ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_client_id" {
  description = "The ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.web.id
}

output "user_pool_domain" {
  description = "The domain of the Cognito User Pool"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "user_pool_endpoint" {
  description = "The endpoint of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.endpoint
}

output "dynamodb_table_name" {
  description = "The name of the DynamoDB table for user preferences"
  value       = aws_dynamodb_table.user_preferences.name
}

output "dynamodb_table_arn" {
  description = "The ARN of the DynamoDB table for user preferences"
  value       = aws_dynamodb_table.user_preferences.arn
}

output "dynamodb_access_policy_arn" {
  description = "The ARN of the IAM policy for DynamoDB access"
  value       = aws_iam_policy.dynamodb_access.arn
}

output "ses_domain_verification_token" {
  description = "SES domain verification token to add to DNS"
  value       = aws_ses_domain_identity.main.verification_token
}

output "ses_dkim_tokens" {
  description = "DKIM tokens for email authentication"
  value       = aws_ses_domain_dkim.main.dkim_tokens
}
