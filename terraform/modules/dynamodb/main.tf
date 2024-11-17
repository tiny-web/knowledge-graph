resource "aws_dynamodb_table" "kg_app_config_ddb" {
  name         = var.kg_app_config_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}