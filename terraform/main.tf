terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }

  # Dynamically set the backend based on workspace
  # backend "s3" {}
}

provider "aws" {
  region = "ap-south-1"
  # profile = terraform.workspace == "prod" ? "prem_vasudeven" : "selectly"
}

data "aws_caller_identity" "current" {}

# #####################################################################
#   SECRETS
# #####################################################################
module "aws_secrets" {
  source = "./modules/secrets"
}

# #####################################################################
#   COMMON
# #####################################################################
module "common" {
  source            = "./modules/common"
  lambda_layer_name = "common_dependencies"
}

# #####################################################################
#   TABLES
# #####################################################################


module "dynamoDb_tables" {
  source                   = "./modules/dynamodb"
  kg_app_config_table_name = "kg_app_config"
}


# #####################################################################
#   REGISTER APP
# #####################################################################
module "register_app_api" {
  source = "./modules/register_app"
  lambda_layer_arn = module.common.lambda_layer_arn
  lambda_name      = "register_app-${data.aws_caller_identity.current.account_id}"
  api_name         = "kg_register_app"
  kg_app_config_table_arn = module.dynamoDb_tables.kg_app_config_table_ddb_arn
  kg_app_config_table_name = module.dynamoDb_tables.jd_table_ddb_name
}

# #####################################################################
#   INGEST KNOWLEDGE
# #####################################################################
module "ingest_knowledge_api" {
  source           = "./modules/ingest_knowledge"
  lambda_layer_arn = module.common.lambda_layer_arn
  lambda_name      = "ingest_knowledge-${data.aws_caller_identity.current.account_id}"
  api_name         = "ingest_knowledge"
  open_ai_api_key  = module.aws_secrets.openai_api_key
  neo4j_uri        = ""
  neo4j_user       = "neo4j"
  neo4j_password   = "" 
  kg_app_config_table_arn = module.dynamoDb_tables.kg_app_config_table_ddb_arn
  kg_app_config_table_name = module.dynamoDb_tables.jd_table_ddb_name
}

# #####################################################################
#   QUERY
# #####################################################################
module "query_api" {
  source           = "./modules/query"
  lambda_layer_arn = module.common.lambda_layer_arn
  lambda_name      = "query_knowledge-${data.aws_caller_identity.current.account_id}"
  api_name         = "query_knowledge"
  open_ai_api_key  = module.aws_secrets.openai_api_key
  neo4j_uri        = ""
  neo4j_user       = "neo4j"
  neo4j_password   = ""

  kg_app_config_table_arn = module.dynamoDb_tables.kg_app_config_table_ddb_arn
  kg_app_config_table_name = module.dynamoDb_tables.jd_table_ddb_name
}
