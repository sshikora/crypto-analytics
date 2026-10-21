locals {
  name = "${var.project_name}-${var.environment}-backend"
  # ALB and target group names are limited to 32 characters.
  lb_name = "${var.project_name}-api"
}

data "aws_region" "current" {}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name}"
  retention_in_days = 30
}

resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = false
  }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the ${var.ecr_images_to_keep} most recent images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.ecr_images_to_keep
        }
        action = { type = "expire" }
      }
    ]
  })
}

# Values are written by the deploy workflow from GitHub secrets.
resource "aws_ssm_parameter" "secret" {
  for_each = toset(var.secret_names)

  name  = "/${var.project_name}/${var.environment}/${each.key}"
  type  = "SecureString"
  value = "set-by-deploy-workflow"

  lifecycle {
    ignore_changes = [value]
  }
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

resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_trust.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions   = ["ssm:GetParameters"]
    resources = [for p in aws_ssm_parameter.secret : p.arn]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_trust.json
}

resource "aws_iam_role_policy_attachment" "task" {
  count = length(var.task_role_policy_arns)

  role       = aws_iam_role.task.name
  policy_arn = var.task_role_policy_arns[count.index]
}

resource "aws_security_group" "alb" {
  name_prefix = "${local.name}-alb-"
  vpc_id      = var.vpc_id
  description = "Public HTTPS for the backend ALB"

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    cidr_blocks     = var.cloudfront_only ? [] : ["0.0.0.0/0"]
    prefix_list_ids = var.cloudfront_only ? [data.aws_ec2_managed_prefix_list.cloudfront.id] : []
  }

  dynamic "ingress" {
    for_each = var.cloudfront_only ? [] : [80]

    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

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

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# Tasks run in public subnets with public IPs instead of behind a NAT gateway; only the ALB can reach them.
resource "aws_security_group" "task" {
  name_prefix = "${local.name}-task-"
  vpc_id      = var.vpc_id
  description = "Backend tasks, reachable only from the ALB"

  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

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

resource "aws_lb" "backend" {
  name               = local.lb_name
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
  security_groups    = [aws_security_group.alb.id]
  idle_timeout       = 60
}

resource "aws_lb_target_group" "backend" {
  name                 = local.lb_name
  port                 = var.container_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 30

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.backend.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.backend.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type = var.reject_unverified_requests ? "fixed-response" : "forward"

    dynamic "forward" {
      for_each = var.reject_unverified_requests ? [] : [aws_lb_target_group.backend.arn]

      content {
        target_group {
          arn = forward.value
        }
      }
    }

    dynamic "fixed_response" {
      for_each = var.reject_unverified_requests ? [403] : []

      content {
        content_type = "text/plain"
        message_body = "Forbidden"
        status_code  = tostring(fixed_response.value)
      }
    }
  }
}

# Requests carrying the secret header that CloudFront adds are forwarded to the backend.
resource "aws_lb_listener_rule" "verified_origin" {
  count = var.origin_verify_header_name == null ? 0 : 1

  listener_arn = aws_lb_listener.https.arn
  priority     = 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    http_header {
      http_header_name = var.origin_verify_header_name
      values           = [var.origin_verify_header_value]
    }
  }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = var.initial_image
      essential = true

      portMappings = [{ containerPort = var.container_port, protocol = "tcp" }]

      environment = [for k, v in var.environment_variables : { name = k, value = v }]
      secrets     = [for k, p in aws_ssm_parameter.secret : { name = k, valueFrom = p.arn }]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "backend"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "backend" {
  name                              = "backend"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.backend.arn
  desired_count                     = 1
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 30

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [aws_security_group.task.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = var.container_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # The deploy workflow registers new revisions with each image.
  lifecycle {
    ignore_changes = [task_definition]
  }

  depends_on = [aws_lb_listener.https]
}

locals {
  # The ALB is IPv4 only; CloudFront also serves IPv6.
  api_record_types = var.api_alias_target == null ? ["A"] : ["A", "AAAA"]
}

resource "aws_route53_record" "api" {
  for_each = var.manage_dns ? toset(local.api_record_types) : toset([])

  zone_id         = var.route53_zone_id
  name            = var.api_domain_name
  type            = each.key
  allow_overwrite = true

  alias {
    name                   = var.api_alias_target == null ? aws_lb.backend.dns_name : var.api_alias_target.dns_name
    zone_id                = var.api_alias_target == null ? aws_lb.backend.zone_id : var.api_alias_target.zone_id
    evaluate_target_health = var.api_alias_target == null
  }
}
