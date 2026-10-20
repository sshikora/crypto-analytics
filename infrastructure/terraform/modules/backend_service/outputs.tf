output "cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.backend.name
}

output "service_arn" {
  description = "ECS service ARN"
  value       = aws_ecs_service.backend.id
}

output "task_family" {
  description = "Task definition family"
  value       = aws_ecs_task_definition.backend.family
}

output "pass_role_arns" {
  description = "Roles a deployer must be able to pass to ECS"
  value       = [aws_iam_role.execution.arn, aws_iam_role.task.arn]
}

output "secret_parameter_arns" {
  description = "SSM parameters holding backend secrets"
  value       = { for k, p in aws_ssm_parameter.secret : k => p.arn }
}

output "alb_dns_name" {
  description = "ALB DNS name for testing before DNS cutover"
  value       = aws_lb.backend.dns_name
}

output "alb_arn_suffix" {
  description = "ALB ARN suffix used as the CloudWatch LoadBalancer dimension"
  value       = aws_lb.backend.arn_suffix
}

output "target_group_arn_suffix" {
  description = "Target group ARN suffix used as the CloudWatch TargetGroup dimension"
  value       = aws_lb_target_group.backend.arn_suffix
}

output "log_group_name" {
  description = "CloudWatch log group for the backend container"
  value       = aws_cloudwatch_log_group.backend.name
}
