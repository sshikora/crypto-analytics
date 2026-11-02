variable "project_name" {
  description = "Project name used in resource names"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "cluster_arn" {
  description = "ECS cluster the jobs run in"
  type        = string
}

variable "vpc_id" {
  description = "VPC for the job tasks"
  type        = string
}

variable "subnet_ids" {
  description = "Public subnets for the job tasks"
  type        = list(string)
}

variable "image" {
  description = "Backend container image, for every job not marked batch"
  type        = string
}

variable "execution_role_arn" {
  description = "ECS execution role; must be able to read the secrets"
  type        = string
}

variable "task_role_policy_arns" {
  description = "Policies attached to the jobs' task role"
  type        = list(string)
  default     = []
}

variable "environment_variables" {
  description = "Plain environment variables for every job"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Environment variable name to SSM parameter ARN"
  type        = map(string)
  default     = {}
}

variable "ecr_images_to_keep" {
  description = "Number of most recent batch images kept in ECR"
  type        = number
  default     = 10
}

variable "alarm_topic_arn" {
  description = "SNS topic for job alarms"
  type        = string
}

variable "jobs" {
  description = "Jobs keyed by name; batch runs the Python batch image with no secrets; about explains the job in its alarm emails"
  type = map(object({
    schedule          = string
    command           = list(string)
    cpu               = optional(number, 256)
    memory            = optional(number, 512)
    batch             = optional(bool, false)
    max_silence_hours = number
    about             = string
  }))
}
