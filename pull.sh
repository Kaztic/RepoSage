#!/bin/bash

# Source environment variables from .env file
if [ -f ~/.env ]; then
  source ~/.env
  echo "Loaded environment variables from .env file"
else
  echo "Warning: .env file not found"
fi

# Script to pull latest Docker images and restart containers on EC2 instance

# Check disk space before starting
echo "=== Checking disk space ==="
DISK_SPACE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_SPACE" -gt 85 ]; then
  echo "WARNING: Disk space is at $DISK_SPACE%. Performing emergency cleanup."
  sudo docker system prune -af --volumes
elif [ "$DISK_SPACE" -gt 70 ]; then
  echo "NOTICE: Disk space is at $DISK_SPACE%. Performing standard cleanup."
  sudo docker system prune -f
fi

# Set GitHub username (use the same as in GitHub Actions) and ensure it's lowercase
GITHUB_USERNAME=${GITHUB_USERNAME:-$(whoami)}
GITHUB_USERNAME=$(echo "$GITHUB_USERNAME" | tr '[:upper:]' '[:lower:]')

# Clean up existing containers and images
echo "=== Cleaning up existing resources ==="
echo "Stopping and removing all containers..."
sudo docker-compose -f docker-compose.deploy.yml down 2>/dev/null || true
sudo docker ps -q | xargs -r sudo docker stop
sudo docker ps -aq | xargs -r sudo docker rm

echo "Removing existing images..."
# First save the image IDs to remove them completely
BACKEND_IMAGES=$(sudo docker images "ghcr.io/$GITHUB_USERNAME/reposage-backend" -q)
FRONTEND_IMAGES=$(sudo docker images "ghcr.io/$GITHUB_USERNAME/reposage-frontend" -q)

# Force remove images by ID to ensure they're completely removed
if [ ! -z "$BACKEND_IMAGES" ]; then
  echo "Removing backend images: $BACKEND_IMAGES"
  echo "$BACKEND_IMAGES" | xargs -r sudo docker rmi -f
fi

if [ ! -z "$FRONTEND_IMAGES" ]; then
  echo "Removing frontend images: $FRONTEND_IMAGES"
  echo "$FRONTEND_IMAGES" | xargs -r sudo docker rmi -f
fi

# Remove any dangling images to free up space
echo "Removing dangling images..."
sudo docker image prune -f

# Login to GitHub Container Registry - using password-stdin method
echo "=== Logging in to GitHub Container Registry ==="
if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable is not set"
  exit 1
fi
echo "$GITHUB_TOKEN" | sudo docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin

# Pull latest images
echo "=== Pulling latest images ==="
sudo docker pull "ghcr.io/$GITHUB_USERNAME/reposage-backend:latest"
sudo docker pull "ghcr.io/$GITHUB_USERNAME/reposage-frontend:latest"

# Create a docker-compose file for deployment
echo "Creating deployment docker-compose file..."
cat > docker-compose.deploy.yml << EOF
version: '3.8'

services:
  backend:
    image: ghcr.io/$GITHUB_USERNAME/reposage-backend:latest
    ports:
      - "8000:8000"
    environment:
      - GEMINI_API_KEY=\${GEMINI_API_KEY:-}
      - GITHUB_TOKEN=\${GITHUB_TOKEN:-}
      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY:-}
      - PORT=8000
      - ALLOWED_ORIGINS=http://13.61.100.168:3000
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/reposage
      - REDIS_URL=redis://redis:6379/0
      - ENCRYPTION_KEY=\${ENCRYPTION_KEY:-default_encryption_key}
      - SECRET_KEY=\${SECRET_KEY:-default_secret_key}
    depends_on:
      - redis
      - postgres
    restart: always

  celery_worker:
    image: ghcr.io/$GITHUB_USERNAME/reposage-backend:latest
    command: celery -A app.celery_app worker --loglevel=info
    environment:
      - GEMINI_API_KEY=\${GEMINI_API_KEY:-}
      - GITHUB_TOKEN=\${GITHUB_TOKEN:-}
      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY:-}
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/reposage
      - REDIS_URL=redis://redis:6379/0
      - ENCRYPTION_KEY=\${ENCRYPTION_KEY:-default_encryption_key}
      - SECRET_KEY=\${SECRET_KEY:-default_secret_key}
    depends_on:
      - redis
      - postgres
      - backend
    restart: always

  frontend:
    image: ghcr.io/$GITHUB_USERNAME/reposage-frontend:latest
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://13.61.100.168:8000
    depends_on:
      - backend
    restart: always

  redis:
    image: redis:7.2-alpine
    ports:
      - "6380:6379"
    volumes:
      - redis_data:/data
    restart: always
    command: redis-server --save 60 1 --loglevel warning

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=reposage
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

volumes:
  redis_data:
  postgres_data:
EOF

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  cat > .env << EOF
GITHUB_USERNAME=$GITHUB_USERNAME
GITHUB_TOKEN=$GITHUB_TOKEN
GEMINI_API_KEY=$GEMINI_API_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ENCRYPTION_KEY=$ENCRYPTION_KEY
SECRET_KEY=$SECRET_KEY
EOF
fi

# Stop and remove existing containers
echo "Stopping existing containers..."
sudo docker-compose -f docker-compose.deploy.yml down

# Clean up all unused containers and volumes
echo "Cleaning up unused resources..."
sudo docker system prune -f

# Start new containers with updated images
echo "Starting updated containers..."
sudo docker-compose -f docker-compose.deploy.yml up -d

# Verify containers are running
echo "Checking container status:"
sudo docker ps

# Check disk space after deployment
echo "=== Checking post-deployment disk space ==="
df -h /

echo "Deployment completed successfully!"
echo "Application should be accessible at:"
echo "Frontend: http://13.61.100.168:3000"
echo "Backend: http://13.61.100.168:8000" 