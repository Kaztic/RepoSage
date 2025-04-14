#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Updating system packages..."
sudo yum update -y

echo "🐳 Installing Docker..."
sudo yum install -y docker

echo "✅ Starting Docker service..."
sudo service docker start

echo "👤 Adding user '$USER' to the docker group..."
sudo usermod -aG docker $USER

echo "🔁 Enabling Docker to start on boot..."
sudo systemctl enable docker

echo "⬇️ Installing Docker Compose v2.20.0..."
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

echo "🔐 Making Docker Compose executable..."
sudo chmod +x /usr/local/bin/docker-compose

echo "📦 Verifying installations..."
docker --version
docker-compose --version

echo "✅ Docker and Docker Compose installation complete!"
echo "⚠️ Please log out and log back in or run 'newgrp docker' for docker group changes to take effect."
