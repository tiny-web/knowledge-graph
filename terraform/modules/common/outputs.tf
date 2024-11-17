output "lambda_layer_arn" {
  value = aws_lambda_layer_version.common_dependency_lambda_layer.arn
}