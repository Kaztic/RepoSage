# RepoSage Enterprise Architecture

## System Architecture Overview

RepoSage Enterprise is built on a modern, scalable microservices architecture designed for performance, reliability, and security. The system is composed of several components that work together to provide an enterprise-grade repository analysis experience.

```
┌────────────────┐     ┌────────────────────────────────────────┐
│                │     │            FRONTEND (Next.js)           │
│                │     │ ┌────────────┐  ┌────────────────────┐  │
│                │     │ │ UI         │  │ State Management   │  │
│  Web Browser   │◄────┼─┤ Components │  │ (React Context)    │  │
│                │     │ └────────────┘  └────────────────────┘  │
│                │     │ ┌─────────────────────────────────────┐ │
│                │     │ │         API Client Services         │ │
└────────────────┘     └─┼─────────────────────────────────────┼─┘
                         │                                     │
                         ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                               API GATEWAY                               │
└───────────┬────────────────────┬──────────────────────┬────────────────┘
            │                    │                      │
            ▼                    ▼                      ▼
┌────────────────────┐  ┌────────────────┐    ┌──────────────────────┐
│  BACKEND (FastAPI) │  │    SECURITY    │    │  STREAMING SERVICE   │
│ ┌────────────────┐ │  │ ┌────────────┐ │    │ ┌──────────────────┐ │
│ │ Repository     │ │  │ │ JWT Auth   │ │    │ │ SSE Handler      │ │
│ │ Analysis       │ │  │ ├────────────┤ │    │ ├──────────────────┤ │
│ ├────────────────┤ │  │ │ RBAC       │ │    │ │ Event Publishing │ │
│ │ Code Structure │ │  │ ├────────────┤ │    │ └──────────────────┘ │
│ │ Analysis       │ │  │ │ API Key    │ │    └──────────────────────┘
│ ├────────────────┤ │  │ │ Management │ │              │
│ │ Semantic       │ │  │ └────────────┘ │              │
│ │ Search         │ │  └────────────────┘              │
│ └────────────────┘ │           │                      │
└────────┬───────────┘           │                      │
         │                       │                      │
         ▼                       ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MESSAGE BROKER (Redis)                      │
└────────────┬─────────────────────────────────────┬───────────────┘
             │                                     │
      ┌──────┴──────┐                      ┌──────┴──────┐
      ▼             ▼                      ▼             ▼
┌─────────────┐ ┌─────────────┐      ┌──────────┐ ┌──────────────┐
│ Repository  │ │ Code        │      │ Claude   │ │ Gemini       │
│ Workers     │ │ Analysis    │      │ AI       │ │ AI           │
│ (Celery)    │ │ Workers     │      │ Service  │ │ Service      │
└─────────────┘ └─────────────┘      └──────────┘ └──────────────┘
       │              │                   │             │
       └──────────────┼───────────────────┼─────────────┘
                      │                   │
                      ▼                   ▼
          ┌───────────────────┐  ┌───────────────────┐
          │     Database      │  │     Cache         │
          │   (PostgreSQL)    │  │     (Redis)       │
          └───────────────────┘  └───────────────────┘
```

## Component Details

### Frontend Layer

- **UI Components**: React components built with Next.js and Tailwind CSS
- **State Management**: React Context API for global state
- **API Client Services**: Axios-based services for communicating with the backend

### Backend Services

- **FastAPI Server**: High-performance asynchronous API server
- **Repository Analysis**: GitPython for repository operations, with advanced code structure analysis
- **Semantic Search**: Hybrid search using BM25 and sentence transformers
- **Security Service**: JWT authentication, role-based access control, and API key management
- **Streaming Service**: Server-sent events (SSE) for real-time AI responses

### Asynchronous Processing

- **Message Broker**: Redis for message passing between services
- **Celery Workers**: Background task processing for compute-intensive operations
  - Repository cloning and analysis
  - Code complexity calculation
  - Technical debt score generation

### AI Integration

- **Claude AI Service**: Integration with Anthropic's Claude Sonnet 3.7 for advanced code understanding
- **Gemini AI Service**: Integration with Google's Gemini Pro for faster responses

### Data Storage

- **PostgreSQL Database**: Persistent storage for:
  - User accounts and authentication
  - Repository metadata
  - Code analysis results
  - Chat history
- **Redis Cache**: High-speed caching for:
  - Frequently accessed repository data
  - AI recommendations
  - Session data

## Key Technical Features

### 1. Advanced Code Analysis

- AST (Abstract Syntax Tree) parsing for code structure understanding
- Cyclomatic complexity measurement
- Function and class relationship mapping
- Code quality and maintainability metrics

### 2. Hybrid Semantic Search

- BM25 algorithm for keyword-based relevance
- Sentence transformer embeddings for semantic understanding
- Vector similarity search for context-aware results

### 3. Streaming AI Responses

- Server-sent events for real-time updates
- Progressive response generation from AI models
- Interrupt and regenerate capabilities

### 4. Enterprise Security

- JWT-based authentication flow
- Role-based access control (RBAC)
- AES-256 encryption for API keys
- Secure password handling with bcrypt

### 5. Scalable Infrastructure

- Containerized deployment with Docker
- Horizontal scaling capabilities
- Redis-based caching for performance
- Celery-based background task processing

## Deployment Architecture

RepoSage Enterprise supports multiple deployment options:

1. **Development**: Docker Compose for local development
2. **Production**: Kubernetes with Helm charts
3. **Hybrid**: Cloud-managed databases with containerized services

The recommended production setup uses Kubernetes for orchestration, managed PostgreSQL, and Redis services with automated backups and monitoring. 