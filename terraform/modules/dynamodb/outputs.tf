output "kg_app_config_table_ddb_arn" {
  value = aws_dynamodb_table.kg_app_config_ddb.arn
}

output "jd_table_ddb_name" {
  value = aws_dynamodb_table.kg_app_config_ddb.name
}