locals {
  name          = "${var.project_name}-${var.environment}-jobs"
  log_namespace = "${var.project_name}/${var.environment}/jobs"
  region        = data.aws_region.current.name

  # Commands quoted in alarm emails; the region is explicit because local CLI defaults may differ.
  tail_logs = "aws logs tail ${aws_cloudwatch_log_group.jobs.name} --region ${local.region}"
  run_now = {
    for key, _ in var.jobs : key => "aws ecs run-task --region ${local.region} --cluster ${element(split("/", var.cluster_arn), 1)} --launch-type FARGATE --task-definition ${local.name}-${key} --network-configuration 'awsvpcConfiguration={subnets=[${join(",", var.subnet_ids)}],securityGroups=[${aws_security_group.jobs.id}],assignPublicIp=ENABLED}'"
  }
}

data "aws_region" "current" {}

resource "aws_cloudwatch_log_group" "jobs" {
  name              = "/ecs/${local.name}"
  retention_in_days = 30
}

data "aws_iam_policy_document" "ecs_tasks_trust" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Jobs get their own task role so the API task never gains their write access.
resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_trust.json
}

resource "aws_iam_role_policy_attachment" "task" {
  count = length(var.task_role_policy_arns)

  role       = aws_iam_role.task.name
  policy_arn = var.task_role_policy_arns[count.index]
}

# Jobs only make outbound calls; there is no NAT, so tasks get a public IP and accept no inbound traffic.
resource "aws_security_group" "jobs" {
  name_prefix = "${local.name}-"
  vpc_id      = var.vpc_id
  description = "Scheduled jobs, outbound only"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

# The image tag is "latest", which the deploy workflow pushes, so each run uses the newest backend build.
resource "aws_ecs_task_definition" "job" {
  for_each = var.jobs

  family                   = "${local.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "job"
      image     = var.image
      essential = true
      command   = each.value.command

      environment = [for k, v in var.environment_variables : { name = k, value = v }]
      secrets     = [for k, arn in var.secrets : { name = k, valueFrom = arn }]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.jobs.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = each.key
        }
      }
    }
  ])
}

data "aws_iam_policy_document" "scheduler_trust" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${local.name}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_trust.json
}

data "aws_iam_policy_document" "scheduler" {
  statement {
    actions   = ["ecs:RunTask"]
    resources = [for td in aws_ecs_task_definition.job : "${td.arn_without_revision}:*"]

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [var.cluster_arn]
    }
  }

  statement {
    actions   = ["iam:PassRole"]
    resources = [var.execution_role_arn, aws_iam_role.task.arn]
  }
}

resource "aws_iam_role_policy" "scheduler" {
  name   = "run-jobs"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler.json
}

resource "aws_scheduler_schedule" "job" {
  for_each = var.jobs

  name                         = "${local.name}-${each.key}"
  schedule_expression          = each.value.schedule
  schedule_expression_timezone = "UTC"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = var.cluster_arn
    role_arn = aws_iam_role.scheduler.arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.job[each.key].arn
      launch_type         = "FARGATE"
      propagate_tags      = "TASK_DEFINITION"

      network_configuration {
        subnets          = var.subnet_ids
        security_groups  = [aws_security_group.jobs.id]
        assign_public_ip = true
      }
    }

    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 3600
    }
  }
}

# The job CLI logs one JSON line per run with event "job_succeeded" or "job_failed".
resource "aws_cloudwatch_log_metric_filter" "succeeded" {
  for_each = var.jobs

  name           = "${local.name}-${each.key}-succeeded"
  log_group_name = aws_cloudwatch_log_group.jobs.name
  pattern        = "{ $.event = \"job_succeeded\" && $.job = \"${each.key}\" }"

  metric_transformation {
    name      = "${each.key}-succeeded"
    namespace = local.log_namespace
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "failed" {
  for_each = var.jobs

  name           = "${local.name}-${each.key}-failed"
  log_group_name = aws_cloudwatch_log_group.jobs.name
  pattern        = "{ $.event = \"job_failed\" && $.job = \"${each.key}\" }"

  metric_transformation {
    name      = "${each.key}-failed"
    namespace = local.log_namespace
    value     = "1"
  }
}

# Also catches runs that never start or crash before logging.
resource "aws_cloudwatch_metric_alarm" "missed_run" {
  for_each = var.jobs

  alarm_name          = "${local.name}-${each.key}-missed-run"
  namespace           = local.log_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.succeeded[each.key].metric_transformation[0].name
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = each.value.max_silence_hours
  datapoints_to_alarm = each.value.max_silence_hours
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching"

  alarm_actions = [var.alarm_topic_arn]

  alarm_description = chomp(<<-EOT
    What it means: no successful ${each.key} run logged in ${each.value.max_silence_hours} hours. ${each.value.about}
    Ignore it on the alarm's first day; it clears after the first run.
    What to do:
    1. Read the log: ${local.tail_logs} --since ${each.value.max_silence_hours}h
    2. A job_failed line means it ran and failed (see the failed-run alarm). No lines means it never started; check the schedule: aws scheduler get-schedule --region ${local.region} --name ${local.name}-${each.key} --query State
    3. Run it now: ${local.run_now[each.key]}
    EOT
  )
}

resource "aws_cloudwatch_metric_alarm" "failed_run" {
  for_each = var.jobs

  alarm_name          = "${local.name}-${each.key}-failed"
  namespace           = local.log_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.failed[each.key].metric_transformation[0].name
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  alarm_actions = [var.alarm_topic_arn]

  alarm_description = chomp(<<-EOT
    What it means: a ${each.key} run logged job_failed, either because it crashed or because too many items failed after retries. ${each.value.about}
    What to do:
    1. Find the failure: ${local.tail_logs} --since 2h --filter-pattern '{ $.event = "job_failed" }'
    2. The line's error or failed field says what went wrong.
    3. Once fixed, run it again: ${local.run_now[each.key]}
    EOT
  )
}
