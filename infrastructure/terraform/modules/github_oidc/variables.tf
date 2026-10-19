variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "github_repository" {
  description = "GitHub repository in owner/name form"
  type        = string
}

variable "deploy_branch" {
  description = "Branch allowed to assume the deploy role"
  type        = string
  default     = "master"
}

variable "terraform_environment" {
  description = "GitHub environment allowed to assume the terraform role"
  type        = string
  default     = "production"
}

variable "ecr_repository_names" {
  description = "ECR repositories the deploy role can push to"
  type        = list(string)
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
}

variable "kubernetes_namespace" {
  description = "Namespace the deploy role can modify"
  type        = string
}

variable "frontend_bucket_arn" {
  description = "S3 bucket the deploy role uploads the frontend to"
  type        = string
}

variable "frontend_distribution_arn" {
  description = "CloudFront distribution the deploy role can invalidate"
  type        = string
}

variable "ecs_service_arn" {
  description = "ECS service the deploy role can update"
  type        = string
}

variable "ecs_pass_role_arns" {
  description = "Task and execution roles the deploy role can pass to ECS"
  type        = list(string)
}

variable "secret_parameter_arns" {
  description = "SSM parameters the deploy role writes backend secrets to"
  type        = list(string)
}
