output "price_history_table_name" {
  description = "Price history table name"
  value       = aws_dynamodb_table.price_history.name
}

output "price_history_table_arn" {
  description = "Price history table ARN"
  value       = aws_dynamodb_table.price_history.arn
}

output "price_history_read_policy_arn" {
  description = "Policy granting read access to the price history table"
  value       = aws_iam_policy.price_history_read.arn
}

output "price_history_write_policy_arn" {
  description = "Policy granting read and write access to the price history table"
  value       = aws_iam_policy.price_history_write.arn
}

output "coin_metrics_table_name" {
  description = "Coin metrics table name"
  value       = aws_dynamodb_table.coin_metrics.name
}

output "coin_metrics_read_policy_arn" {
  description = "Policy granting read access to the coin metrics table"
  value       = aws_iam_policy.coin_metrics_read.arn
}

output "coin_metrics_write_policy_arn" {
  description = "Policy granting read and write access to the coin metrics table"
  value       = aws_iam_policy.coin_metrics_write.arn
}
