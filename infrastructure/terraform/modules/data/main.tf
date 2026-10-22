locals {
  prefix = "${var.project_name}-${var.environment}"
}

# One row per coin per day. CoinGecko attributes are written first; other sources add their own attributes to the same row.
resource "aws_dynamodb_table" "price_history" {
  name                        = "${local.prefix}-price-history"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "coinId"
  range_key                   = "date"
  deletion_protection_enabled = true

  attribute {
    name = "coinId"
    type = "S"
  }

  attribute {
    name = "date"
    type = "S"
  }

  # Demo CoinGecko keys only reach back 365 days, so rows older than that cannot be re-fetched.
  point_in_time_recovery {
    enabled = true
  }
}

resource "aws_iam_policy" "price_history_read" {
  name        = "${local.prefix}-price-history-read"
  description = "Read the price history table"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Query"]
        Resource = [aws_dynamodb_table.price_history.arn]
      }
    ]
  })
}

resource "aws_iam_policy" "price_history_write" {
  name        = "${local.prefix}-price-history-write"
  description = "Read and write the price history table"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:BatchGetItem",
          "dynamodb:Query",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:BatchWriteItem",
        ]
        Resource = [aws_dynamodb_table.price_history.arn]
      }
    ]
  })
}
