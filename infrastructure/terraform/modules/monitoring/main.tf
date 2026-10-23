locals {
  prefix = "${var.project_name}-${var.environment}"

  # Commands quoted in alarm emails; the region is explicit because local CLI defaults may differ.
  region         = data.aws_region.current.name
  service_events = "aws ecs describe-services --region ${local.region} --cluster ${var.ecs_cluster_name} --services ${var.ecs_service_name} --query 'services[0].events[:5].message'"
  tail_logs      = "aws logs tail ${var.log_group_name} --region ${local.region}"

  utilization_impact = {
    CPUUtilization    = "API responses slow down."
    MemoryUtilization = "The task is near its memory limit; if it runs out, ECS restarts it and the API is down for a minute or two."
  }
}

data "aws_region" "current" {}

# Email subscriptions are added outside OpenTofu so addresses stay out of the repository.
resource "aws_sns_topic" "alerts" {
  name = "${local.prefix}-alerts"
}

resource "aws_cloudwatch_metric_alarm" "api_no_healthy_targets" {
  alarm_name          = "${local.prefix}-api-no-healthy-targets"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  alarm_description = chomp(<<-EOT
    What it means: the API load balancer has had no healthy backend task for 2 minutes, so every API request fails. The site loads but can't show market data or notification rules.
    Urgency: act now.
    What to do:
    1. See why tasks stopped or failed health checks: ${local.service_events}
    2. Read the backend log: ${local.tail_logs} --since 30m
    3. If a deploy just ran, ECS rolls back one that never turns healthy; check the run at ${var.deploy_runs_url}. If the previous version fails too, revert the last commit on master.
    An OK email means a healthy task is serving again.
    EOT
  )
}

resource "aws_cloudwatch_metric_alarm" "api_target_5xx" {
  alarm_name          = "${local.prefix}-api-target-5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  alarm_description = chomp(<<-EOT
    What it means: the backend answered 5 or more API requests with a server error (HTTP 5xx) within 5 minutes, so some users saw failed requests.
    Urgency: look today; act now if it keeps firing.
    What to do:
    1. Find the errors: ${local.tail_logs} --since 1h --filter-pattern '?error ?Error'
    2. If they started with a deploy (${var.deploy_runs_url}), revert that commit on master.
    3. A single burst that stopped by itself needs nothing more than reading the log.
    EOT
  )
}

resource "aws_cloudwatch_metric_alarm" "api_elb_5xx" {
  alarm_name          = "${local.prefix}-api-elb-5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  alarm_description = chomp(<<-EOT
    What it means: the load balancer itself returned 5 or more errors (HTTP 502/503/504) within 5 minutes because it couldn't reach a working backend task.
    Urgency: none if it fired once while a deploy was swapping tasks; act now if it repeats or the no-healthy-targets alarm also fired.
    What to do:
    1. Check whether a deploy was running at the time: ${var.deploy_runs_url}
    2. Otherwise see why tasks are unhealthy: ${local.service_events}
    EOT
  )
}

resource "aws_cloudwatch_metric_alarm" "ecs_utilization" {
  for_each = toset(["CPUUtilization", "MemoryUtilization"])

  alarm_name          = "${local.prefix}-backend-${lower(trimsuffix(each.key, "Utilization"))}-high"
  namespace           = "AWS/ECS"
  metric_name         = each.key
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 85
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  alarm_description = chomp(<<-EOT
    What it means: the backend task averaged over 85% ${lower(trimsuffix(each.key, "Utilization"))} for 15 minutes. ${local.utilization_impact[each.key]}
    Urgency: look today.
    What to do:
    1. Look for a traffic spike or a runaway loop in the log: ${local.tail_logs} --since 1h
    2. If the load is real and this keeps happening, raise the backend's cpu and memory in the backend_service module.
    EOT
  )
}

resource "aws_cloudwatch_log_metric_filter" "cron_errors" {
  name           = "${local.prefix}-cron-errors"
  log_group_name = var.log_group_name
  pattern        = "?\"Crossover checker failed\" ?AccessDeniedException"

  metric_transformation {
    name          = "CronErrors"
    namespace     = "${var.project_name}/${var.environment}"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "cron_errors" {
  alarm_name          = "${local.prefix}-backend-cron-errors"
  namespace           = "${var.project_name}/${var.environment}"
  metric_name         = aws_cloudwatch_log_metric_filter.cron_errors.metric_transformation[0].name
  statistic           = "Sum"
  period              = 900
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]

  alarm_description = chomp(<<-EOT
    What it means: the backend's 5-minute notification check logged "Crossover checker failed", or a backend call to AWS was denied (AccessDeniedException). Notification rules aren't being evaluated, so users miss alerts until it's fixed.
    Urgency: look today.
    What to do:
    1. Show the errors: ${local.tail_logs} --since 1h --filter-pattern '?"Crossover checker failed" ?AccessDeniedException'
    2. AccessDeniedException names the missing IAM action, usually after an infrastructure change; grant it to the backend task role in the backend_service module.
    3. Anything else is a code or DynamoDB error; the log line includes it.
    EOT
  )
}

resource "aws_route53_health_check" "endpoint" {
  for_each = var.health_check_urls

  fqdn              = each.value.fqdn
  port              = 443
  type              = "HTTPS"
  resource_path     = each.value.path
  failure_threshold = 3
  request_interval  = 30
  regions           = var.health_check_regions

  tags = {
    Name = "${local.prefix}-${each.key}"
  }
}

resource "aws_cloudwatch_metric_alarm" "endpoint_down" {
  for_each = var.health_check_urls

  alarm_name          = "${local.prefix}-${each.key}-down"
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.endpoint[each.key].id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  alarm_description = chomp(<<-EOT
    What it means: https://${each.value.fqdn}${each.value.path} has failed Route53 health checks from several regions for 2 minutes. ${each.value.impact}
    Urgency: act now.
    What to do:
    1. Open https://${each.value.fqdn}${each.value.path} yourself to confirm.
    ${chomp(each.value.checks)}
    An OK email means it is passing checks again.
    EOT
  )
}
