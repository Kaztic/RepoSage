#!/bin/bash
set -e

# Set AWS region
REGION="us-east-1"
STACK_NAME="reposage-backend-dev"

# Get the REST API ID from CloudFormation outputs
echo "Getting REST API ID..."
API_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query "Stacks[0].Outputs[?OutputKey=='ServiceEndpointRestApiId'].OutputValue" --output text)

if [ -z "$API_ID" ]; then
  echo "Trying alternative approach to get API ID..."
  API_ID=$(aws cloudformation describe-stack-resources --stack-name $STACK_NAME --region $REGION --query "StackResources[?ResourceType=='AWS::ApiGateway::RestApi'].PhysicalResourceId" --output text)
fi

if [ -z "$API_ID" ]; then
  echo "Could not find API ID, trying to list all APIs..."
  API_ID=$(aws apigateway get-rest-apis --region $REGION --query "items[?name=='$STACK_NAME'].id" --output text)
fi

if [ -z "$API_ID" ]; then
  echo "Error: Could not find API ID"
  exit 1
fi

echo "Found API ID: $API_ID"

# Get the deployment stage
STAGE="dev"

# Construct the service endpoint
ENDPOINT="https://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}"

echo "API Endpoint: $ENDPOINT"
echo "ENDPOINT=$ENDPOINT" >> $GITHUB_ENV

# Export endpoint for use in pipeline
echo "::set-output name=endpoint::$ENDPOINT" 