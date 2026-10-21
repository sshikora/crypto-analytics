locals {
  prefix = "${var.project_name}-${var.environment}"
}

# Email subscriptions are added outside OpenTofu so addresses stay out of the repository.
resource "aws_sns_topic" "alerts" {
  name = "${local.prefix}-alerts"
}

resource "aws_cloudwatch_metric_alarm" "api_no_healthy_targets" {
  alarm_name          = "${local.prefix}-api-no-healthy-targets"
  alarm_description   = "No healthy backend tasks behind the API load balancer"
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
}

resource "aws_cloudwatch_metric_alarm" "api_target_5xx" {
  alarm_name          = "${local.prefix}-api-target-5xx"
  alarm_description   = "Backend returned 5xx responses"
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
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "api_elb_5xx" {
  alarm_name          = "${local.prefix}-api-elb-5xx"
  alarm_description   = "Load balancer returned 5xx responses, usually because no backend was reachable"
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
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "ecs_utilization" {
  for_each = toset(["CPUUtilization", "MemoryUtilization"])

  alarm_name          = "${local.prefix}-backend-${lower(trimsuffix(each.key, "Utilization"))}-high"
  alarm_description   = "Backend ${each.key} above 85% for 15 minutes"
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
  ok_actions    = [aws_sns_topic.alerts.arn]
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
  alarm_description   = "Crossover checker failed or the backend was denied AWS access"
  namespace           = "${var.project_name}/${var.environment}"
  metric_name         = aws_cloudwatch_log_metric_filter.cron_errors.metric_transformation[0].name
  statistic           = "Sum"
  period              = 900
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
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
  alarm_description   = "https://${each.value.fqdn}${each.value.path} is failing external health checks"
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
}
