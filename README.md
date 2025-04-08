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
  - **Weaviate Integration**: Advanced vector database for improved semantic code search

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

### Environment Variables

Create a `.env` file at the root of the project with the following variables:

```
GEMINI_API_KEY=your_gemini_pro_api_key
ANTHROPIC_API_KEY=your_claude_api_key
GITHUB_TOKEN=your_github_token
ENCRYPTION_KEY=random_32_character_string
SECRET_KEY=another_random_string
WEAVIATE_URL=http://weaviate:8080
```

### Local Development

1. Clone this repository
2. Set up environment variables in `.env` file
3. Build and run with Docker Compose:
   ```
   docker-compose up -d
   ```

### Using Weaviate for Semantic Search

RepoSage Enterprise can use Weaviate as a vector database for semantic search, which provides several advantages over the default sentence transformer approach:

1. **Better Scalability**: Handles larger codebases with millions of lines of code
2. **Faster Search**: Production-ready vector search optimized for performance
3. **Persistent Storage**: Embeddings persisted between application restarts

Weaviate is enabled by default in the Docker Compose configuration. The system will automatically:

1. Create a Weaviate schema for repository files
2. Store file contents and generate embeddings using the text2vec-transformers module
3. Perform semantic search through Weaviate's query interface

You can configure the Weaviate connection with these environment variables:
- `WEAVIATE_URL`: Weaviate server URL (default: http://weaviate:8080 in Docker)
- `WEAVIATE_API_KEY`: Optional authentication key if your Weaviate instance requires it

For more advanced configurations, check the Weaviate documentation.

### Enterprise Deployment

For production deployment, we recommend:

1. Use Kubernetes for orchestration (Helm charts provided)
2. Configure TLS with your preferred certificate provider
3. Set up database backups and monitoring
4. Implement GitHub webhook integration for real-time updates

## License

MIT 


# TO DO

USE THIS MODEL - gemini-2.0-flash-thinking-exp-1219	