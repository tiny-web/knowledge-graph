data "aws_secretsmanager_secret" "openai_api" {
  name = "openai/api_key"
}

data "aws_secretsmanager_secret_version" "openai_api" {
  secret_id = data.aws_secretsmanager_secret.openai_api.id
}

output "openai_api_key" {
  value     = jsondecode(data.aws_secretsmanager_secret_version.openai_api.secret_string)["openai_api_key"]
  sensitive = true
}