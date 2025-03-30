# Stop existing containers
sudo docker-compose down

# Rebuild and start containers
# sudo docker-compose build --no-cache
sudo docker-compose up --build -d

# View logs of the backend container
sudo docker-compose logs -f backend