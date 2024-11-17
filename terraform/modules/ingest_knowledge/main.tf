# IAM Role for Lambda
resource "aws_iam_role" "ingest_knowledge_lambda_role" {
  name = "ingest_knowledge_lambda_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach Policy to IAM Role
resource "aws_iam_role_policy" "ingest_knowledge_lambda_policy" {
  name = "ingest_knowledge_lambda_policy"
  role = aws_iam_role.ingest_knowledge_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Action = [
          "dynamodb:GetItem",       # Needed for fetchFromDdb
          "dynamodb:PutItem",       # Needed for putItem
          "dynamodb:Query",         # Needed for queryDdb
          "dynamodb:Scan",          # Needed for fetchAllFromDdb
          "dynamodb:BatchWriteItem" # Needed for batchPutItems
        ]
        Effect = "Allow"
        Resource = [
          "${var.kg_app_config_table_arn}"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attachment" {
  role       = aws_iam_role.ingest_knowledge_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda Function
data "archive_file" "ingest_knowledge_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/src.zip"
}

resource "aws_lambda_function" "ingest_knowledge_lambda" {
  function_name    = var.lambda_name
  role             = aws_iam_role.ingest_knowledge_lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.ingest_knowledge_lambda_zip.output_path
  source_code_hash = data.archive_file.ingest_knowledge_lambda_zip.output_base64sha256
  timeout          = 300 #5 mins
  environment {
    variables = {
      OPEN_AI_API_KEY          = var.open_ai_api_key
      NEO4J_URI                = var.neo4j_uri
      NEO4J_USER               = var.neo4j_user
      NEO4J_PASSWORD           = var.neo4j_password
      KG_APP_CONFIG_TABLE_NAME = var.kg_app_config_table_name
    }
  }

  layers = [
    var.lambda_layer_arn
  ]
}

# API Gateway Setup
resource "aws_api_gateway_rest_api" "ingest_knowledge_api" {
  name        = var.api_name
  description = "Get Keyword and Tags API Gateway"
}

resource "aws_api_gateway_resource" "ingest_knowledge_resource" {
  rest_api_id = aws_api_gateway_rest_api.ingest_knowledge_api.id
  parent_id   = aws_api_gateway_rest_api.ingest_knowledge_api.root_resource_id
  path_part   = "ingest"
}

resource "aws_api_gateway_method" "post_method" {
  rest_api_id   = aws_api_gateway_rest_api.ingest_knowledge_api.id
  resource_id   = aws_api_gateway_resource.ingest_knowledge_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_integration" {
  rest_api_id             = aws_api_gateway_rest_api.ingest_knowledge_api.id
  resource_id             = aws_api_gateway_resource.ingest_knowledge_resource.id
  http_method             = aws_api_gateway_method.post_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.ingest_knowledge_lambda.invoke_arn
}

resource "aws_lambda_permission" "api_gateway_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingest_knowledge_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.ingest_knowledge_api.execution_arn}/*/*"
}

resource "aws_api_gateway_method_response" "post_200" {
  rest_api_id = aws_api_gateway_rest_api.ingest_knowledge_api.id
  resource_id = aws_api_gateway_resource.ingest_knowledge_resource.id
  http_method = aws_api_gateway_method.post_method.http_method
  status_code = "200"

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }
}

resource "aws_api_gateway_integration_response" "post_200" {
  rest_api_id = aws_api_gateway_rest_api.ingest_knowledge_api.id
  resource_id = aws_api_gateway_resource.ingest_knowledge_resource.id
  http_method = aws_api_gateway_method.post_method.http_method
  status_code = aws_api_gateway_method_response.post_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
  }

  depends_on = [aws_api_gateway_integration.lambda_integration]
}

resource "aws_api_gateway_method" "options" {
  rest_api_id   = aws_api_gateway_rest_api.ingest_knowledge_api.id
  resource_id   = aws_api_gateway_resource.ingest_knowledge_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_integration" {
  rest_api_id = aws_api_gateway_rest_api.ingest_knowledge_api.id
  resource_id = aws_api_gateway_resource.ingest_knowledge_resource.id
  http_method = aws_api_gateway_method.options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_200" {
  rest_api_id = aws_api_gateway_rest_api.ingest_knowledge_api.id
  resource_id = aws_api_gateway_resource.ingest_knowledge_resource.id
  http_method = aws_api_gateway_method.options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }

  response_models = {
    "application/json" = "Empty"
  }

  depends_on = [aws_api_gateway_integration.lambda_integration]
}

resource "aws_api_gateway_integration_response" "ingest_knowledge_options_200" {
  rest_api_id = aws_api_gateway_rest_api.ingest_knowledge_api.id
  resource_id = aws_api_gateway_resource.ingest_knowledge_resource.id
  http_method = aws_api_gateway_method.options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
  }

  response_templates = {
    "application/json" = ""
  }
}

# Deploy API Gateway
resource "aws_api_gateway_deployment" "ingest_knowledge_api_deployment" {
  rest_api_id = aws_api_gateway_rest_api.ingest_knowledge_api.id

  depends_on = [
    aws_api_gateway_integration.lambda_integration,
    aws_api_gateway_method_response.post_200,
    aws_api_gateway_integration_response.post_200,
    aws_api_gateway_method_response.options_200,
    aws_api_gateway_integration_response.ingest_knowledge_options_200
  ]
}

resource "aws_api_gateway_stage" "ingest_knowledge_stage" {
  deployment_id = aws_api_gateway_deployment.ingest_knowledge_api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.ingest_knowledge_api.id
  stage_name    = "prod"

  # access_log_settings {
  #   destination_arn = aws_cloudwatch_log_group.api_gateway_log_group.arn
  #   format          = "$context.requestId $context.httpMethod $context.resourcePath $context.status $context.responseLatency"
  # }
}
# resource "aws_cloudwatch_log_group" "api_gateway_log_group" {
#   name = "/aws/apiGateway/${aws_api_gateway_rest_api.ingest_knowledge_api.name}"
# }

