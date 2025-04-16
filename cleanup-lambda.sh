#!/bin/bash
set -e

echo "Cleaning up previous Lambda deployment..."

# Set AWS region
REGION="us-east-1"
FUNCTION_NAME="reposage-backend-dev-app"

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &>/dev/null; then
  echo "Found existing Lambda function, cleaning up..."
  
  # Remove previous layer versions to free up storage
  echo "Cleaning up previous layer versions..."
  LAYER_ARNS=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.Layers[*].Arn' --output text)
  
  for LAYER_ARN in $LAYER_ARNS; do
    LAYER_NAME=$(echo $LAYER_ARN | cut -d':' -f7)
    LAYER_VERSION=$(echo $LAYER_ARN | cut -d':' -f8)
    
    echo "Found layer: $LAYER_NAME version: $LAYER_VERSION"
    
    # Get all versions of this layer and delete older ones
    VERSIONS=$(aws lambda list-layer-versions --layer-name $LAYER_NAME --region $REGION --query 'LayerVersions[*].Version' --output text)
    
    for VERSION in $VERSIONS; do
      if [ "$VERSION" -lt "$LAYER_VERSION" ]; then
        echo "Deleting old version $VERSION of layer $LAYER_NAME"
        aws lambda delete-layer-version --layer-name $LAYER_NAME --version-number $VERSION --region $REGION
      fi
    done
  done
  
  echo "Cleaning up Lambda storage..."
  
  # Update function code with a minimal package to clear storage
  # We'll create a minimal zip file with just a handler
  mkdir -p /tmp/minimal-lambda
  echo 'def handler(event, context): return {"statusCode": 200, "body": "Placeholder"}' > /tmp/minimal-lambda/app.py
  (cd /tmp/minimal-lambda && zip -r /tmp/minimal-lambda.zip .)
  
  # Update function with minimal code
  aws lambda update-function-code --function-name $FUNCTION_NAME --zip-file fileb:///tmp/minimal-lambda.zip --region $REGION
  
  echo "Lambda cleaned up successfully!"
else
  echo "Lambda function not found, no cleanup needed."
fi

echo "Ready for deployment!" 