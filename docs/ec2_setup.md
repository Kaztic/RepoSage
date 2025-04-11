# EC2 Instance Setup for CI/CD Pipeline

This document outlines the steps needed to set up your EC2 instance to work with the GitHub Actions CI/CD pipeline.

## Prerequisites

- An AWS t3.micro EC2 instance running
- Docker and Docker Compose installed
- SSH access to the instance

## EC2 Instance Setup Steps

1. **Install Docker and Docker Compose**:

   ```bash
   # Update package lists
   sudo apt-get update

   # Install required packages
   sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common

   # Add Docker's official GPG key
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

   # Add Docker repository
   sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

   # Install Docker
   sudo apt-get update
   sudo apt-get install -y docker-ce

   # Add your user to the docker group
   sudo usermod -aG docker $USER

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Copy required files to EC2 instance**:

   - Upload docker-compose.yml to the EC2 instance's home directory
   - Upload the pull.sh script to the home directory and make it executable:

   ```bash
   chmod +x ~/pull.sh
   ```

3. **Set up environment variables**:

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

4. **Test the setup**:

   Run the pull.sh script manually to make sure it works:

   ```bash
   bash ~/pull.sh
   ```

## Setting up GitHub Secrets

In your GitHub repository, you need to add the following secrets:

1. Navigate to your repository's Settings > Secrets > Actions
2. Add the following secrets:
   - `EC2_HOST`: The public IP or domain of your EC2 instance
   - `EC2_USER`: The username to SSH into your EC2 instance (e.g., ubuntu, ec2-user)
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

## Verifying the Setup

After setting up everything and pushing to the main branch:

1. Check GitHub Actions workflow run status in the Actions tab of your repository
2. Verify that the Docker images are pushed to GitHub Container Registry
3. Check that the containers are deployed and running on your EC2 instance

## Troubleshooting

- If the SSH connection fails, check that your EC2 security group allows SSH (port 22) connections.
- If Docker login fails, verify that your GitHub token has the necessary permissions.
- Check EC2 instance logs: `/var/log/cloud-init-output.log` for any errors during startup. 