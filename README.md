# RepoSage Enterprise

A state-of-the-art, enterprise-grade AI-powered GitHub repository analysis chatbot.

## Overview

RepoSage Enterprise is an advanced AI assistant that leverages Claude Sonnet 3.7 and Gemini Pro to provide deep insights into GitHub repositories. It analyzes code structure, commit history, and documentation to deliver intelligent, context-aware answers through a modern, interactive interface.

## Enterprise Features

- **AI-Driven Repository Intelligence**
  - **Advanced Code Understanding**: AST-based parsing for analyzing function dependencies, design patterns, and architectural insights
  - **Commit History Analysis**: Identify high-impact commits and understand repository evolution
  - **Documentation Quality Assessment**: Evaluate documentation against industry standards

- **Next-Level Semantic Search**
  - **Vector-Based Search**: Hybrid model combining BM25 + sentence transformer embeddings
  - **Contextual Query Understanding**: Intelligent expansion of user queries
  - **Multi-Modal Search Support**: Code-snippet and commit-message based searches

- **Enterprise-Grade Architecture**
  - **High Performance Backend**: FastAPI with async task queues (Celery/Redis)
  - **Robust Data Storage**: PostgreSQL for repository metadata with Redis caching
  - **Security & Compliance**: Role-based access control, encrypted API keys

- **Best-in-Class UI/UX**
  - **Enhanced Chat Interface**: Claude Sonnet chain-of-thought reasoning
  - **Code Analysis Views**: Complexity metrics, AI-powered recommendations
  - **Visual Repository Analytics**: Technical Debt Score based on code quality metrics

- **Flexible Deployment Options**
  - **Containerized Deployments**: Docker and Kubernetes ready
  - **API & Webhook Support**: GraphQL and REST API endpoints
  - **Third-Party Integrations**: Support for CI/CD pipelines

## AI Models

RepoSage Enterprise features dual AI model support:

- **Claude Sonnet 3.7**: Deep reasoning for precise code analysis, better at understanding complex repo structures and providing detailed explanations.
- **Gemini Pro**: Fast responses for common queries and lightweight repository exploration.

## Usage

1. **Clone a Repository**: Enter a GitHub repository URL and authenticate if needed
2. **Explore Code Structure**: Browse files and analyze code complexity
3. **Ask Questions**: Chat with the AI about any aspect of the repository
4. **View Metrics**: Examine code quality scores and technical debt analysis
5. **Get Recommendations**: Receive AI-powered suggestions for code improvements

## Architecture

RepoSage Enterprise is built with a modern, scalable architecture:

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: FastAPI with Celery async processing
- **AI**: Claude Sonnet 3.7 and Gemini Pro for intelligent responses
- **Database**: PostgreSQL with Redis caching
- **Analysis**: Advanced embeddings for semantic code search
- **Security**: JWT authentication with role-based access control
- **Deployment**: Docker Compose with separate services

## Setup

### Prerequisites

- GitHub repository access
- Claude Sonnet 3.7 API key
- Gemini Pro API key
- Docker and Docker Compose

### Local Development

1. Clone this repository
2. Set up environment variables:
   ```
   cp backend/.env.template backend/.env
   ```
   Then edit the `.env` file with your API keys and configuration
3. Start the development environment:
   ```
   docker-compose up -d
   ```
4. Visit `http://localhost:3000` in your browser

### Enterprise Deployment

For production deployment, we recommend:

1. Use Kubernetes for orchestration (Helm charts provided)
2. Configure TLS with your preferred certificate provider
3. Set up database backups and monitoring
4. Implement GitHub webhook integration for real-time updates

## License

MIT 

