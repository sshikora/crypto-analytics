output "task_definition_families" {
  description = "Task definition family for each job"
  value       = { for k, td in aws_ecs_task_definition.job : k => td.family }
}

output "security_group_id" {
  description = "Security group for job tasks, for one-off runs"
  value       = aws_security_group.jobs.id
}

output "log_group_name" {
  description = "CloudWatch log group for all jobs"
  value       = aws_cloudwatch_log_group.jobs.name
}
