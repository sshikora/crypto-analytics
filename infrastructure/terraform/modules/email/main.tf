# Email Infrastructure Module
# Configures AWS SES and Google Workspace DNS records

# ==========================================
# AWS SES Configuration
# ==========================================

# Verify domain with SES
resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

# DKIM tokens for SES (email authentication)
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# Email identity for sending (e.g., noreply@cryptoquantlab.com)
resource "aws_ses_email_identity" "noreply" {
  email = "noreply@${var.domain_name}"
}

# ==========================================
# Route53 DNS Records for SES
# ==========================================

# SES Domain verification TXT record
resource "aws_route53_record" "ses_verification" {
  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main.verification_token]
}

# SES DKIM records (3 CNAME records for email authentication)
resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# SPF record for SES (merged with Google Workspace SPF)
# This allows both Google and SES to send email from your domain
resource "aws_route53_record" "spf" {
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 300
  records = [
    # Includes both Google and Amazon SES
    "v=spf1 include:_spf.google.com include:amazonses.com ~all"
  ]
}

# ==========================================
# Google Workspace MX Records
# ==========================================

# MX records for Google Workspace (receiving email)
resource "aws_route53_record" "google_mx" {
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = 3600

  records = [
    "1 ASPMX.L.GOOGLE.COM",
    "5 ALT1.ASPMX.L.GOOGLE.COM",
    "5 ALT2.ASPMX.L.GOOGLE.COM",
    "10 ALT3.ASPMX.L.GOOGLE.COM",
    "10 ALT4.ASPMX.L.GOOGLE.COM",
  ]
}

# Google Workspace DKIM record
# You'll get this value from Google Workspace admin console
# For now, this is a placeholder - update after Google provides the key
resource "aws_route53_record" "google_dkim" {
  count   = var.google_dkim_value != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "google._domainkey.${var.domain_name}"
  type    = "TXT"
  ttl     = 300
  records = [var.google_dkim_value]
}

# ==========================================
# IAM Policy for Backend to Send Email via SES
# ==========================================

# IAM policy that allows sending email via SES
resource "aws_iam_policy" "ses_send_email" {
  name        = "${var.environment}-ses-send-email"
  description = "Allow backend to send email via SES"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = [
              "noreply@${var.domain_name}",
              "support@${var.domain_name}"
            ]
          }
        }
      }
    ]
  })
}

# Attach SES policy to the EKS node role (so backend pods can send email)
resource "aws_iam_role_policy_attachment" "eks_node_ses" {
  role       = var.eks_node_role_name
  policy_arn = aws_iam_policy.ses_send_email.arn
}
