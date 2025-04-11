#!/bin/bash

# Script to pull latest Docker images and restart containers on EC2 instance

# Set GitHub username (use the same as in GitHub Actions)
GITHUB_USERNAME=${GITHUB_USERNAME:-$(whoami)}

# Login to GitHub Container Registry
echo "Logging in to GitHub Container Registry..."
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# Pull latest images
echo "Pulling latest images..."
docker pull ghcr.io/$GITHUB_USERNAME/reposage-backend:latest
docker pull ghcr.io/$GITHUB_USERNAME/reposage-frontend:latest

# Stop and remove existing containers
echo "Stopping existing containers..."
docker-compose down

# Start new containers with updated images
echo "Starting updated containers..."
docker-compose up -d

echo "Deployment completed successfully!" 