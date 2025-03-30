# RepoSage

A full-stack GitHub-integrated chatbot that answers user queries based on repository content and history.

## Overview

RepoSage is a smart assistant that leverages the Gemini API to provide detailed responses to questions about GitHub repositories. It analyzes commit history, codebase content, and documentation to give context-aware answers through an interactive web interface.

## Features

- **ChatGPT-style UI** for live interaction with repositories
- **GitHub-like file explorer** to visualize and browse repositories
- **Semantic search** across repository content for accurate responses
- **Intelligent analysis** of commit history and code
- **No repository cloning required** for users - everything happens in the browser
- **Deployment options** including Docker, GitHub Actions, and cloud hosting

## Usage

1. Visit the web interface and enter a GitHub repository URL
2. Explore the repository structure in the sidebar
3. Ask questions about the codebase in the chat interface
4. View relevant files highlighted in the file explorer
5. Open files directly from the file explorer to view their content

## Architecture

RepoSage is built with a modern full-stack architecture:

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: FastAPI server with async processing
- **AI**: Gemini API for generating intelligent responses
- **Repository Analysis**: GitPython and sentence embeddings for semantic search
- **Deployment**: Docker containers for easy deployment

## Setup

### Prerequisites

- GitHub repository
- Gemini API key
- Docker (optional, for containerized deployment)

### Local Development

1. Clone this repository
2. Set up the backend:
   ```
   cd backend
   pip install -r requirements.txt
   cp .env.template .env  # Then edit with your API keys
   python app.py
   ```
3. Set up the frontend:
   ```
   cd frontend
   npm install
   cp .env.local.example .env.local  # Edit if needed
   npm run dev
   ```
4. Visit `http://localhost:3000` in your browser

### Docker Deployment

1. Clone this repository
2. Create a `.env` file in the root directory with:
   ```
   GEMINI_API_KEY=your-gemini-api-key
   GITHUB_TOKEN=your-github-token (optional)
   ```
3. Run with Docker Compose:
   ```
   docker-compose up -d
   ```
4. Visit `http://localhost:3000` in your browser

### Cloud Deployment

For production deployment, you can:

1. Deploy the frontend to Vercel by connecting your repository
2. Deploy the backend to a service like Google Cloud Run, Render, or Heroku
3. Update the environment variables to point to your deployed backend

## License

MIT 