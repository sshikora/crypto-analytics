output "deploy_role_arn" {
  description = "IAM role assumed by the deploy workflow"
  value       = aws_iam_role.deploy.arn
}

output "terraform_role_arn" {
  description = "IAM role assumed by the terraform workflow"
  value       = aws_iam_role.terraform.arn
}
