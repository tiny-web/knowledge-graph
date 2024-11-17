# Ensure that Node.js dependencies are installed for Lambda 
resource "null_resource" "install_node_modules" {
  provisioner "local-exec" {
    command = <<EOT
      cd ${path.module}/lambda_layer/nodejs/node20
      npm install
    EOT
  }

  triggers = {
    always_run = null
    package_json_hash = filemd5("${path.module}/lambda_layer/nodejs/node20/package.json")
  }
}

data "archive_file" "common_dependency_lambda_layers" {
  depends_on = [null_resource.install_node_modules]
  type        = "zip"
  source_dir  = "${path.module}/lambda_layer"
  output_path = "${path.module}/lambda_layer.zip"
}


resource "aws_lambda_layer_version" "common_dependency_lambda_layer" {
  layer_name          = "${var.lambda_layer_name}"

  filename            = data.archive_file.common_dependency_lambda_layers.output_path
  source_code_hash    = data.archive_file.common_dependency_lambda_layers.output_base64sha256
  
  compatible_runtimes = [ "nodejs20.x" ]
}