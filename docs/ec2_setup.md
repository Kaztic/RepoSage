# Split Deployment Setup for RepoSage

This document outlines the steps needed to set up your environment for the split deployment of RepoSage, where:
- Frontend (Next.js) is deployed to Vercel
- Backend (FastAPI) and databases are deployed to AWS EC2

## Prerequisites

- An AWS EC2 instance (t3.micro or larger) running Amazon Linux 2023
- SSH access to the instance
- GitHub repository with appropriate permissions
- Vercel account with proper configuration

## EC2 Instance Setup for Backend Deployment

1. **Connect to your EC2 instance**:
   
   ```bash
   ssh -i your-key.pem ec2-user@your-ec2-ip
   ```

2. **Install Docker and Docker Compose**:

   For Amazon Linux 2023:
   ```bash
   # Update package lists
   sudo yum update -y

   # Install Docker
   sudo yum install -y docker

   # Start Docker service and enable on boot
   sudo systemctl start docker
   sudo systemctl enable docker

   # Add your user to the docker group
   sudo usermod -aG docker $USER
   
   # Log out and log back in for group changes to take effect
   # or run this command:
   newgrp docker

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   
   # Verify installations
   docker --version &&   docker-compose --version
   ```

3. **Configure Firewall to Open Required Ports**:

   Amazon Linux 2023 uses firewalld for firewall configuration:
   ```bash
   # Install firewalld if not already installed
   sudo yum install -y firewalld
   
   # Start and enable firewalld
   sudo systemctl start firewalld
   sudo systemctl enable firewalld
   
   # Open ports for the backend services
   sudo firewall-cmd --permanent --add-port=8000/tcp
   sudo firewall-cmd --permanent --add-port=5432/tcp
   sudo firewall-cmd --permanent --add-port=6380/tcp
   
   # Apply changes
   sudo firewall-cmd --reload
   
   # Verify open ports
   sudo firewall-cmd --list-all
   ```

   Also configure AWS Security Group for your EC2 instance:
   1. Go to EC2 Dashboard in AWS Console
   2. Select your instance
   3. Go to "Security" tab
   4. Click on the security group
   5. Add inbound rules for the following ports:
      - Port 22 (SSH) - restrict to your IP
      - Port 8000 (Backend API)
      - Port 5432 (PostgreSQL) - consider restricting to specific IPs
      - Port 6380 (Redis) - consider restricting to specific IPs

4. **Copy backend deployment script to EC2 instance**:

   Upload the pull-backend.sh script to the home directory and make it executable:

   ```bash
   scp -i your-key.pem pull-backend.sh ec2-user@your-ec2-ip:~/
   ssh -i your-key.pem ec2-user@your-ec2-ip "chmod +x ~/pull-backend.sh"
   ```

5. **Set up environment variables**:

   Create a `.env` file in the home directory with all required environment variables:

   ```bash
   touch ~/.env
   ```

   Add the following environment variables to this file:

   ```
   GITHUB_USERNAME=your-github-username
   GITHUB_TOKEN=your-github-token
   GEMINI_API_KEY=your-gemini-api-key
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ENCRYPTION_KEY=your-encryption-key
   SECRET_KEY=your-secret-key
   FRONTEND_URL=https://reposage.vercel.app
   ```

   Note: The `FRONTEND_URL` should point to your Vercel-deployed frontend application URL.

6. **Configure AWS CLI** (Optional):

   If you need to interact with AWS services from your EC2 instance:

   ```bash
   # Install AWS CLI if not already installed
   sudo yum install -y aws-cli
   
   # Configure AWS credentials
   aws configure
   ```

   When prompted, enter the following information:
   ```
   AWS Access Key ID: [YOUR_ACCESS_KEY]
   AWS Secret Access Key: [YOUR_SECRET_KEY]
   Default region name: [YOUR_REGION] (e.g., us-east-1)
   Default output format: json
   ```

## Vercel Setup for Frontend Deployment

1. **Connect Your GitHub Repository to Vercel**:
   - Go to Vercel dashboard (https://vercel.com/dashboard)
   - Click "Add New" > "Project"
   - Import your GitHub repository
   - Configure the project:
     - Root Directory: ./frontend
     - Framework Preset: Next.js
     - Build Command: npm run build
     - Output Directory: .next

2. **Set Up Environment Variables in Vercel**:
   - In your Vercel project settings, navigate to "Environment Variables"
   - Add the following variables:
     - `NEXT_PUBLIC_API_URL`: The URL of your backend API (e.g., http://your-ec2-public-ip:8000)

3. **Get Vercel Deployment Tokens**:
   - Go to Vercel account settings > Tokens
   - Create a new token with "Full Access" scope
   - Save this token as you'll need it for GitHub Actions

## Setting up GitHub Secrets

In your GitHub repository, you need to add the following secrets:

1. Navigate to your repository's Settings > Secrets > Actions
2. Add the following secrets:
   - `EC2_HOST`: The public IP of your EC2 instance
   - `EC2_USER`: The username to SSH into your EC2 instance (e.g., ec2-user)
   - `EC2_KEY`: Your private SSH key for accessing the EC2 instance
   - `VERCEL_TOKEN`: Your Vercel API token
   - `VERCEL_ORG_ID`: Your Vercel organization ID (find in project settings)
   - `VERCEL_PROJECT_ID`: Your Vercel project ID (find in project settings)
   - `NEXT_PUBLIC_API_URL`: The URL of your backend API

## SSH Key Pair for EC2 Access

To set up the SSH key for GitHub Actions:

1. Generate a new SSH key pair:

   ```bash
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions
   ```

2. Add the public key to the EC2 instance's authorized_keys:

   ```bash
   cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
   ```

3. Copy the private key content:

   ```bash
   cat ~/.ssh/github_actions
   ```

4. Paste the entire private key (including the BEGIN and END lines) into the `EC2_KEY` secret in GitHub.

## Split Deployment Configuration

The split deployment process uses the following components:

1. **GitHub Actions Workflow**: Located at `.github/workflows/deploy.yml` in your repository, it:
   - Deploys the frontend to Vercel
   - Builds the backend Docker image and pushes it to GitHub Container Registry
   - Deploys the backend to your EC2 instance via SSH

2. **Backend Docker Containers on EC2**:
   - Backend (FastAPI): Accessible on port 8000
   - PostgreSQL: Accessible on port 5432
   - Redis: Accessible on port 6380 (maps to internal 6379)

3. **Frontend on Vercel**:
   - Next.js application deployed and managed by Vercel
   - Automatically handles CDN distribution, SSL, and scaling

4. **Backend Pull Script**: The `pull-backend.sh` script located on the EC2 instance:
   - Logs into GitHub Container Registry
   - Pulls the latest backend image
   - Starts the backend containers using docker-compose

## Verifying the Deployment

After setting up everything and pushing to the main branch:

1. Check GitHub Actions workflow run status in the Actions tab of your repository
2. Verify that backend Docker containers are running on your EC2 instance:
   ```bash
   docker ps
   ```
3. Check if backend ports are correctly listening:
   ```bash
   sudo netstat -tulpn | grep -E '8000|5432|6380'
   ```
4. Access the applications:
   - Frontend: https://reposage.vercel.app (or your Vercel deployment URL)
   - Backend API: http://your-ec2-public-ip:8000

## CORS Configuration

Ensure the backend has proper CORS configuration to accept requests from the Vercel frontend:

1. In your backend code, ensure the `ALLOWED_ORIGINS` environment variable is set to your Vercel frontend URL.
2. The backend configuration in `pull-backend.sh` already sets this environment variable.

## Troubleshooting

### Connectivity Issues:
- If backend services are not accessible, verify the port mappings:
  ```bash
  docker inspect -f '{{json .NetworkSettings.Ports}}' CONTAINER_ID
  ```
- Verify security group and firewalld configurations allow traffic on relevant ports

### Container Issues:
- Check container logs:
  ```bash
  docker logs CONTAINER_ID
  ```
- If containers are stuck, try restarting Docker:
  ```bash
  sudo systemctl restart docker
  ```

### CORS Issues:
- If frontend cannot connect to backend, check browser console for CORS errors
- Verify the `ALLOWED_ORIGINS` in backend configuration matches the Vercel URL exactly

### Vercel Deployment Issues:
- Check build logs in Vercel dashboard
- Verify environment variables are correctly set
- Try triggering a manual deployment from the Vercel dashboard 