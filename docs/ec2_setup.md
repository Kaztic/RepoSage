# EC2 Instance Setup for CI/CD Pipeline

This document outlines the steps needed to set up your EC2 instance to work with the GitHub Actions CI/CD pipeline for RepoSage.

## Prerequisites

- An AWS EC2 instance (t3.micro or larger) running Amazon Linux 2023
- SSH access to the instance
- GitHub repository with appropriate permissions

## EC2 Instance Setup Steps

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
   docker --version && docker-compose --version
   ```

3. **Configure Firewall to Open Required Ports**:

   Amazon Linux 2023 uses firewalld for firewall configuration:
   ```bash
   # Install firewalld if not already installed
   sudo yum install -y firewalld
   
   # Start and enable firewalld
   sudo systemctl start firewalld
   sudo systemctl enable firewalld
   
   # Open ports for the application
   sudo firewall-cmd --permanent --add-port=3000/tcp
   sudo firewall-cmd --permanent --add-port=8000/tcp
   sudo firewall-cmd --permanent --add-port=5432/tcp
   sudo firewall-cmd --permanent --add-port=6380/tcp
   
   # Apply changes
   sudo firewall-cmd --reload
   
   # Verify open ports
   sudo firewall-cmd --list-all
   ```

   If firewalld is not available or you prefer to use iptables directly:
   ```bash
   # Add iptables rules directly
   sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
   sudo iptables -A INPUT -p tcp --dport 8000 -j ACCEPT
   sudo iptables -A INPUT -p tcp --dport 5432 -j ACCEPT
   sudo iptables -A INPUT -p tcp --dport 6380 -j ACCEPT
   
   # These rules won't persist after reboot unless saved
   # Note: Amazon Linux 2023 might not have the iptables service
   ```

   Also configure AWS Security Group for your EC2 instance:
   1. Go to EC2 Dashboard in AWS Console
   2. Select your instance
   3. Go to "Security" tab
   4. Click on the security group
   5. Add inbound rules for the following ports:
      - Port 22 (SSH) - restrict to your IP
      - Port 3000 (Frontend)
      - Port 8000 (Backend API)
      - Port 5432 (PostgreSQL) - consider restricting to specific IPs
      - Port 6380 (Redis) - consider restricting to specific IPs

4. **Copy required files to EC2 instance**:

   Upload the pull.sh script to the home directory and make it executable:

   ```bash
   chmod +x ~/pull.sh
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
   ```

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

   This will create credential files in the `~/.aws/` directory. You can also set these credentials manually:

   ```bash
   mkdir -p ~/.aws
   
   cat > ~/.aws/credentials << EOF
   [default]
   aws_access_key_id = YOUR_ACCESS_KEY
   aws_secret_access_key = YOUR_SECRET_KEY
   EOF
   
   cat > ~/.aws/config << EOF
   [default]
   region = YOUR_REGION
   output = json
   EOF
   ```

   You can verify the configuration with:
   ```bash
   aws sts get-caller-identity
   ```

## Setting up GitHub Secrets

In your GitHub repository, you need to add the following secrets:

1. Navigate to your repository's Settings > Secrets > Actions
2. Add the following secrets:
   - `EC2_HOST`: The public IP of your EC2 instance
   - `EC2_USER`: The username to SSH into your EC2 instance (e.g., ec2-user)
   - `EC2_KEY`: Your private SSH key for accessing the EC2 instance

## SSH Key Pair

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

## Deployment Configuration

The deployment process uses the following components:

1. **GitHub Actions Workflow**: Located at `.github/workflows/deploy.yml` in your repository, it:
   - Builds Docker images for frontend and backend
   - Pushes images to GitHub Container Registry
   - Deploys to your EC2 instance via SSH

2. **Docker Containers**:
   - Frontend (Next.js): Accessible on port 3000
   - Backend (FastAPI): Accessible on port 8000
   - PostgreSQL: Accessible on port 5432
   - Redis: Accessible on port 6380 (maps to internal 6379)

3. **Pull Script**: The `pull.sh` script located on the EC2 instance:
   - Logs into GitHub Container Registry
   - Pulls the latest images
   - Starts the containers using docker-compose

## Verifying the Deployment

After setting up everything and pushing to the main branch:

1. Check GitHub Actions workflow run status in the Actions tab of your repository
2. Verify that Docker containers are running on your EC2 instance:
   ```bash
   docker ps
   ```
3. Check if ports are correctly listening:
   ```bash
   sudo netstat -tulpn | grep -E '3000|8000|5432|6380'
   ```
4. Access the application:
   - Frontend: http://your-ec2-public-ip:3000
   - Backend API: http://your-ec2-public-ip:8000

## Troubleshooting

### Connectivity Issues:
- If services are not accessible, verify the port mappings:
  ```bash
  docker inspect -f '{{json .NetworkSettings.Ports}}' CONTAINER_ID
  ```
- Verify security group and iptables configurations allow traffic on relevant ports

### Container Issues:
- Check container logs:
  ```bash
  docker logs CONTAINER_ID
  ```
- If containers are stuck, try restarting Docker:
  ```bash
  sudo systemctl restart docker
  ```
- Check disk space:
  ```bash
  df -h
  ```

### Deployment Issues:
- If deployment gets stuck, SSH into the EC2 instance and check:
  ```bash
  # View Docker process status
  sudo systemctl status docker
  
  # Force cleanup all Docker resources if needed
  docker system prune -af --volumes
  
  # Restart Docker
  sudo systemctl restart docker
  ```

### Port Forwarding Issues:
- Verify that your frontend container is correctly mapping port 3000:
  ```bash
  # For frontend
  docker exec -it FRONTEND_CONTAINER_ID sh -c "netstat -tulpn"
  ```
- Check if the Nginx or other service is correctly listening on the expected port 