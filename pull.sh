#!/bin/bash

# Script to pull latest Docker images and restart containers on EC2 instance

# Set GitHub username (use the same as in GitHub Actions)
GITHUB_USERNAME=${GITHUB_USERNAME:-$(whoami)}

# Login to GitHub Container Registry - using password-stdin method
echo "Logging in to GitHub Container Registry..."
if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable is not set"
  exit 1
fi
echo "$GITHUB_TOKEN" | sudo docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin

# Pull latest images
echo "Pulling latest images..."
sudo docker pull "ghcr.io/$GITHUB_USERNAME/reposage-backend:latest"
sudo docker pull "ghcr.io/$GITHUB_USERNAME/reposage-frontend:latest"

# Create a simple docker-compose file for deployment if it doesn't exist
if [ ! -f docker-compose.deploy.yml ]; then
  echo "Creating deployment docker-compose file..."
  cat > docker-compose.deploy.yml << EOF
version: '3.8'

services:
  backend:
    image: ghcr.io/$GITHUB_USERNAME/reposage-backend:latest
    ports:
      - "8000:80"
    restart: always

  frontend:
    image: ghcr.io/$GITHUB_USERNAME/reposage-frontend:latest
    ports:
      - "3000:80"
    restart: always
EOF
fi

# Stop and remove existing containers
echo "Stopping existing containers..."
sudo docker-compose -f docker-compose.deploy.yml down

# Start new containers with updated images
echo "Starting updated containers..."
sudo docker-compose -f docker-compose.deploy.yml up -d

echo "Deployment completed successfully!" 