# Migration from EC2 to AWS Lambda

This document outlines the migration of the RepoSage backend from an EC2-based deployment to a serverless deployment using AWS Lambda and the Serverless Framework.

## Architecture Changes

The backend has been migrated from:

- **Previous Architecture**: FastAPI on EC2 instance with Docker, PostgreSQL, and Redis
- **New Architecture**: FastAPI on AWS Lambda with API Gateway

### Key Benefits

1. **Cost Efficiency**: Lambda's pay-per-use model reduces costs for varying workloads
2. **Scalability**: Automatic scaling based on request volume
3. **Reduced Maintenance**: No need to manage EC2 instances and handle maintenance tasks
4. **High Availability**: AWS Lambda provides built-in high availability across multiple Availability Zones

## Technical Changes

The following technical changes were made:

1. Added **Mangum** adapter to wrap the FastAPI application for AWS Lambda
2. Created a **serverless.yml** configuration file for deployment
3. Updated GitHub Actions workflow to deploy to Lambda instead of EC2
4. Modified CORS settings to accept requests from the Vercel frontend
5. Configured environment variables for Lambda and Vercel integration

## Required AWS Setup

To complete this migration, you need to set up the following AWS resources:

1. **IAM User** with programmatic access and the following permissions:
   - AWSLambdaFullAccess
   - IAMFullAccess
   - AmazonAPIGatewayAdministrator
   - CloudFormationFullAccess
   - AmazonS3FullAccess

2. Add the following **GitHub Secrets** for CI/CD:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `FRONTEND_URL` (your Vercel app URL)
   - Other existing secrets (GEMINI_API_KEY, ANTHROPIC_API_KEY, etc.)

## Local Development

For local development:

1. Install the Serverless Framework:
   ```bash
   npm install -g serverless
   ```

2. Install the Python requirements plugin:
   ```bash
   cd backend
   npm install --save-dev serverless-python-requirements
   ```

3. Run locally using serverless offline:
   ```bash
   cd backend
   serverless offline
   ```

4. For deployment testing:
   ```bash
   cd backend
   serverless deploy
   ```

## Monitoring and Troubleshooting

- **CloudWatch Logs**: All Lambda logs can be viewed in CloudWatch
- **API Gateway Dashboard**: Monitor API Gateway metrics and endpoint usage
- **Lambda Dashboard**: View Lambda execution metrics, errors, and throttling

## Rollback Plan

If necessary, the system can be rolled back to the EC2 deployment by:

1. Reverting the GitHub workflow changes
2. Setting the NEXT_PUBLIC_API_URL back to the EC2 URL
3. Rerunning the GitHub Actions workflow 