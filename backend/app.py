#!/usr/bin/env python3
"""
RepoSage Backend API Server
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import tempfile
import uuid

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Request, Body, Security, status
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, SecurityScopes
from pydantic import BaseModel, Field, EmailStr
import asyncio
import aiohttp
from github import Github
from git import Repo, GitCommandError
import numpy as np
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from dotenv import load_dotenv

# Database and caching imports
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from sqlalchemy.sql import func
from redis import Redis
from celery import Celery
from passlib.context import CryptContext
from jose import JWTError, jwt
from cryptography.fernet import Fernet
from rank_bm25 import BM25Okapi

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('reposage')

# Import RepoAnalyzer from existing chatbot module
from chatbot import RepoAnalyzer, GeminiClient, ClaudeClient

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./reposage.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = Redis.from_url(REDIS_URL, decode_responses=True)

# Celery configuration
celery_app = Celery(
    "reposage",
    broker=REDIS_URL,
    backend=REDIS_URL
)

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", "".join([str(uuid.uuid4()) for _ in range(2)]))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Encryption for sensitive data
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
fernet = Fernet(ENCRYPTION_KEY.encode())

# Database models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    
    repositories = relationship("Repository", back_populates="owner")
    api_keys = relationship("ApiKey", back_populates="user")

class ApiKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    key_name = Column(String, index=True)
    key_prefix = Column(String, index=True)
    hashed_key = Column(String)
    encrypted_key = Column(String)
    service = Column(String)  # "github", "anthropic", "gemini", etc.
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    
    user = relationship("User", back_populates="api_keys")

class Repository(Base):
    __tablename__ = "repositories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    full_name = Column(String, index=True)
    url = Column(String, index=True)
    description = Column(Text)
    default_branch = Column(String)
    local_path = Column(String)
    last_analyzed = Column(DateTime)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    
    owner = relationship("User", back_populates="repositories")
    commits = relationship("Commit", back_populates="repository")
    files = relationship("File", back_populates="repository")
    metrics = relationship("RepositoryMetrics", back_populates="repository", uselist=False)

class Commit(Base):
    __tablename__ = "commits"
    
    id = Column(Integer, primary_key=True, index=True)
    hash = Column(String, index=True)
    short_hash = Column(String, index=True)
    message = Column(Text)
    author = Column(String)
    author_email = Column(String)
    date = Column(DateTime)
    files_changed = Column(Integer)
    insertions = Column(Integer)
    deletions = Column(Integer)
    repository_id = Column(Integer, ForeignKey("repositories.id"))
    
    repository = relationship("Repository", back_populates="commits")
    file_changes = relationship("FileChange", back_populates="commit")

class File(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True, index=True)
    path = Column(String, index=True)
    size = Column(Integer)
    binary = Column(Boolean, default=False)
    repository_id = Column(Integer, ForeignKey("repositories.id"))
    
    repository = relationship("Repository", back_populates="files")
    metrics = relationship("FileMetrics", back_populates="file", uselist=False)
    changes = relationship("FileChange", back_populates="file")

class FileChange(Base):
    __tablename__ = "file_changes"
    
    id = Column(Integer, primary_key=True, index=True)
    change_type = Column(String)  # "added", "modified", "deleted", "renamed"
    old_path = Column(String)
    new_path = Column(String)
    insertions = Column(Integer)
    deletions = Column(Integer)
    file_id = Column(Integer, ForeignKey("files.id"))
    commit_id = Column(Integer, ForeignKey("commits.id"))
    
    file = relationship("File", back_populates="changes")
    commit = relationship("Commit", back_populates="file_changes")

class FileMetrics(Base):
    __tablename__ = "file_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), unique=True)
    lines_of_code = Column(Integer)
    cyclomatic_complexity = Column(Float)
    maintainability_index = Column(Float)
    comment_ratio = Column(Float)
    last_updated = Column(DateTime, server_default=func.now())
    
    file = relationship("File", back_populates="metrics")

class RepositoryMetrics(Base):
    __tablename__ = "repository_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), unique=True)
    total_files = Column(Integer)
    total_lines = Column(Integer)
    avg_complexity = Column(Float)
    technical_debt_score = Column(Float)
    commit_frequency = Column(Float)  # Average commits per day
    contributor_count = Column(Integer)
    last_updated = Column(DateTime, server_default=func.now())
    
    repository = relationship("Repository", back_populates="metrics")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    
    messages = relationship("ChatMessage", back_populates="session")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    role = Column(String)  # "user" or "assistant"
    content = Column(Text)
    timestamp = Column(DateTime, server_default=func.now())
    session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    
    session = relationship("ChatSession", back_populates="messages")

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="RepoSage API",
    description="Backend API for RepoSage GitHub-integrated chatbot",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure more specifically in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache for repositories analyzed
repo_cache = {}

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic models for request and response objects
class RepoRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None
    access_token: Optional[str] = None

class ChatMessage(BaseModel):
    role: str = Field(..., description="The role of the message sender (user or assistant)")
    content: str = Field(..., description="The content of the message")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)

class ChatRequest(BaseModel):
    repo_url: str
    messages: List[ChatMessage]
    access_token: Optional[str] = None
    model_name: Optional[str] = "models/gemini-2.0-flash"  # Default model
    model_provider: Optional[str] = "gemini"  # 'gemini' or 'claude'

class CommitInfo(BaseModel):
    hash: str
    short_hash: str
    author: str
    date: str
    message: str
    stats: Dict[str, Any]

async def fetch_and_analyze_repo(repo_url: str, access_token: Optional[str] = None):
    """Fetch and analyze a repository."""
    try:
        # First validate the repository URL
        validation_result = await validate_git_repo(repo_url, access_token)
        if not validation_result["valid"]:
            logger.error(f"Invalid repository URL: {validation_result['reason']}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid repository URL: {validation_result['reason']}"
            )
        
        # Generate a unique path for the repository to prevent conflicts
        # Extract repo name from URL (handle both .git and non-.git URLs)
        url_parts = repo_url.rstrip('/').split('/')
        repo_name = url_parts[-1]
        if repo_name.endswith('.git'):
            repo_name = repo_name[:-4]
        
        # Generate a unique path based on repo name and a timestamp to prevent conflicts
        unique_id = f"{int(datetime.now().timestamp())}"
        repo_path = f"/tmp/reposage_{repo_name}_{unique_id}"
        
        logger.info(f"Fetching repository {repo_url} to {repo_path}")
        
        # Clone repository
        clone_url = repo_url
        if access_token and clone_url.startswith('https://'):
            # Add token to URL for private repos
            clone_url = clone_url.replace('https://', f'https://{access_token}@')
        
        # Clone without depth limitation for better commit history access
        logger.info(f"Cloning repository {repo_url} to {repo_path}")
        Repo.clone_from(clone_url, repo_path)
        logger.info(f"Repository cloned to {repo_path}")
        
        # Initialize and run analysis on the cloned repo
        analyzer = RepoAnalyzer(repo_path)
        analysis = analyzer.analyze_repo()
        
        # Store in cache with the unique path
        repo_cache[repo_url] = {
            "analysis": analysis,
            "analyzer": analyzer,
            "path": repo_path,
            "last_updated": datetime.now()
        }
        
        return analysis
        
    except GitCommandError as e:
        logger.error(f"Git error during repository fetch: {e}")
        raise HTTPException(status_code=500, detail=f"Git error: {str(e)}")
    except HTTPException:
        # Re-raise already formatted HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error during repository fetch and analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing repository: {str(e)}")

@app.get("/")
async def read_root():
    """Root endpoint to check if API is running."""
    return {"status": "ok", "message": "RepoSage API is running"}

@app.post("/api/repo-structure")
async def get_repo_structure(repo_request: RepoRequest, background_tasks: BackgroundTasks):
    """Get repository structure."""
    repo_url = repo_request.repo_url
    access_token = repo_request.access_token
    
    # Check cache first
    if repo_url in repo_cache:
        # Return cached data if available and recent enough (add staleness check if needed)
        analysis = repo_cache[repo_url]["analysis"]
        return {
            "status": "success", 
            "repo_info": analysis["repo_info"],
            "file_structure": analysis["file_structure"],
            "important_files": analysis["important_files"]
        }

    # If not cached, proceed with validation and fetching
    try:
        # Validate the repository URL first
        # Consider if validate_git_repo is still necessary if fetch_and_analyze handles errors
        validation_result = await validate_git_repo(repo_url, access_token)
        if not validation_result["valid"]:
            # It's better to let fetch_and_analyze_repo handle the clone error
            # directly for consistency, but keep validation for quick checks if desired.
            # If keeping validation, ensure its error messages are distinct.
             raise HTTPException(
                 status_code=400, # Use 400 for bad input
                 detail=f"Invalid or inaccessible repository: {validation_result.get('reason', 'Unknown reason')}"
             )

        # *** CHANGE: Await the fetch and analysis directly ***
        # This will block until cloning/analysis is done or fails
        analysis = await fetch_and_analyze_repo(repo_url, access_token)
        
        # If successful, return the structure
        return {
            "status": "success", 
            "repo_info": analysis["repo_info"],
            "file_structure": analysis["file_structure"],
            "important_files": analysis["important_files"]
        }

    except HTTPException as e:
        # Re-raise HTTPExceptions (like the one from fetch_and_analyze_repo or validation)
        raise e
    except Exception as e:
        # Catch any other unexpected errors during the process
        logger.error(f"Unexpected error in get_repo_structure for {repo_url}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while processing the repository.")

    # Removed the old background task logic and "processing" response.
    # Removed the final cache check as it's handled at the beginning now.

@app.post("/api/commits")
async def get_commit_history(repo_request: RepoRequest):
    """Get repository commit history."""
    repo_url = repo_request.repo_url
    access_token = repo_request.access_token
    
    # Check if repo is already cached
    if repo_url not in repo_cache:
        # Analyze repo if not cached (will be a blocking operation here)
        await fetch_and_analyze_repo(repo_url, access_token)
    
    # Return commit history
    analysis = repo_cache[repo_url]["analysis"]
    return {
        "status": "success", 
        "commit_history": analysis["commit_history"]
    }

@app.post("/api/full-commit-history")
async def get_full_commit_history(repo_request: RepoRequest):
    """Get complete commit history from the beginning of the repository with file diffs."""
    repo_url = repo_request.repo_url
    access_token = repo_request.access_token
    
    # Check if repo is already cached
    if repo_url not in repo_cache:
        # Analyze repo if not cached (will be a blocking operation here)
        await fetch_and_analyze_repo(repo_url, access_token)
    
    try:
        # Create a Gemini client to use its history retrieval method
        analyzer = repo_cache[repo_url]["analyzer"]
        gemini_client = GeminiClient(analyzer)
        
        # Get the full commit history with diffs
        full_history = gemini_client.get_full_commit_history()
        
        return {
            "status": "success", 
            "commit_history": full_history
        }
    except Exception as e:
        logger.error(f"Error getting full commit history: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving commit history: {str(e)}")

@app.post("/api/file-content")
async def get_file_content(request: Dict[str, str] = Body(...)):
    """Get content of a specific file."""
    repo_url = request.get("repo_url")
    file_path = request.get("file_path")
    access_token = request.get("access_token")
    
    if not repo_url or not file_path:
        raise HTTPException(status_code=400, detail="repo_url and file_path are required")
    
    # Check if repo is already cached
    if repo_url not in repo_cache:
        # Analyze repo if not cached (will be a blocking operation here)
        await fetch_and_analyze_repo(repo_url, access_token)
    
    analyzer = repo_cache[repo_url]["analyzer"]
    
    # Get file content
    if file_path in analyzer.file_contents:
        return {
            "status": "success",
            "file_path": file_path,
            "content": analyzer.file_contents[file_path]
        }
    else:
        raise HTTPException(status_code=404, detail=f"File {file_path} not found in repository")

@app.post("/api/chat")
async def chat_with_repo(chat_request: ChatRequest):
    """Chat with repository assistant using Gemini models."""
    repo_url = chat_request.repo_url
    messages = chat_request.messages
    access_token = chat_request.access_token
    model_name = chat_request.model_name
    
    # Handle different Gemini models
    if not model_name or model_name == "default":
        model_name = "models/gemini-2.0-flash"  # Default model
    elif model_name == "gemini-2.0-flash":
        model_name = "models/gemini-2.0-flash"
    elif model_name == "models/gemini-2.0-flash-thinking-exp-1219":
        # This is already in the correct format, but we keep this explicit for clarity
        model_name = "models/gemini-2.0-flash-thinking-exp-1219"
    
    # Check if repo is already cached
    if repo_url not in repo_cache:
        # Analyze repo if not cached (will be a blocking operation)
        await fetch_and_analyze_repo(repo_url, access_token)
    
    # Create Gemini client with repo analysis
    gemini_client = GeminiClient(repo_cache[repo_url]["analyzer"], model_name=model_name)
    
    # Process the chat messages
    try:
        response = await gemini_client.chat(messages)
        
        return {
            "status": "success",
            "response": response
        }
    except Exception as e:
        logger.error(f"Error in chat processing: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

@app.post("/api/chat/claude")
async def chat_with_claude(chat_request: ChatRequest, background_tasks: BackgroundTasks):
    """Chat with repository assistant using Claude models."""
    repo_url = chat_request.repo_url
    messages = chat_request.messages
    access_token = chat_request.access_token
    model_name = chat_request.model_name
    
    # Handle different Claude models
    if not model_name or model_name == "default":
        model_name = "claude-3-sonnet-20240229"  # Default Claude model
    elif model_name == "claude-3-opus":
        model_name = "claude-3-opus-20240229"
    elif model_name == "claude-3-haiku":
        model_name = "claude-3-haiku-20240307"
    
    # Check if repo is already cached
    if repo_url not in repo_cache:
        # Analyze repo if not cached (will be a blocking operation)
        await fetch_and_analyze_repo(repo_url, access_token)
    
    # Create Claude client with repo analysis
    claude_client = ClaudeClient(repo_cache[repo_url]["analyzer"], model_name=model_name)
    
    # For streaming responses
    async def stream_claude_response():
        try:
            # Use Claude's streaming capability
            async for chunk in await claude_client.chat(messages):
                # Convert to SSE format
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            logger.error(f"Error in Claude streaming: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"
    
    # Return a streaming response
    return StreamingResponse(stream_claude_response(), media_type="text/event-stream")

@app.post("/api/code-analysis")
async def analyze_file_code(
    background_tasks: BackgroundTasks,
    file_analysis_request: Dict[str, str] = Body(...)
):
    """Analyze code complexity and provide recommendations for a specific file."""
    repo_url = file_analysis_request.get("repo_url")
    file_path = file_analysis_request.get("file_path")
    access_token = file_analysis_request.get("access_token")
    
    if not repo_url or not file_path:
        raise HTTPException(status_code=400, detail="repo_url and file_path are required")
    
    # Check if repo is already cached
    if repo_url not in repo_cache:
        # Analyze repo if not cached
        await fetch_and_analyze_repo(repo_url, access_token)
    
    # Create Claude client
    claude_client = ClaudeClient(repo_cache[repo_url]["analyzer"])
    
    # Get complexity metrics
    complexity_metrics = claude_client.analyze_code_complexity(file_path)
    
    # Get code recommendations in background
    background_tasks.add_task(cache_code_recommendations, repo_url, file_path, claude_client)
    
    return {
        "status": "success",
        "file_path": file_path,
        "complexity_metrics": complexity_metrics,
        "recommendations_status": "processing"
    }

async def cache_code_recommendations(repo_url, file_path, claude_client):
    """Background task to generate and cache code recommendations."""
    try:
        recommendations = claude_client.generate_code_recommendations(file_path)
        
        # Cache the recommendations
        cache_key = f"recommendations:{repo_url}:{file_path}"
        redis_client.set(cache_key, json.dumps(recommendations))
        redis_client.expire(cache_key, 3600 * 24)  # Expire after 24 hours
        
        logger.info(f"Cached recommendations for {file_path}")
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")

@app.get("/api/code-recommendations/{repo_url}/{file_path}")
async def get_code_recommendations(
    repo_url: str,
    file_path: str
):
    """Get cached code recommendations for a file."""
    # URL-decode the file path
    import urllib.parse
    file_path = urllib.parse.unquote(file_path)
    
    # Check cache
    cache_key = f"recommendations:{repo_url}:{file_path}"
    cached = redis_client.get(cache_key)
    
    if cached:
        return {
            "status": "success",
            "file_path": file_path,
            "recommendations": json.loads(cached)
        }
    else:
        return {
            "status": "not_ready",
            "message": "Recommendations are still being generated"
        }

@app.post("/api/ast-analysis")
async def analyze_code_ast(request: Dict[str, str] = Body(...)):
    """Analyze code AST for deeper understanding of code structure."""
    repo_url = request.get("repo_url")
    file_path = request.get("file_path")
    access_token = request.get("access_token")
    
    if not repo_url or not file_path:
        raise HTTPException(status_code=400, detail="repo_url and file_path are required")
    
    # Check if repo is already cached
    if repo_url not in repo_cache:
        # Analyze repo if not cached
        await fetch_and_analyze_repo(repo_url, access_token)
    
    # Get file content
    analyzer = repo_cache[repo_url]["analyzer"]
    content = analyzer.file_contents.get(file_path)
    
    if not content:
        raise HTTPException(status_code=404, detail=f"File {file_path} not found in repository")
    
    # Determine file type and parse appropriately
    ast_result = {"functions": [], "classes": [], "imports": [], "file_path": file_path}
    
    try:
        if file_path.endswith(".py"):
            # Python AST analysis
            import ast
            tree = ast.parse(content)
            
            # Extract imports
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for name in node.names:
                        ast_result["imports"].append({"name": name.name, "alias": name.asname})
                elif isinstance(node, ast.ImportFrom):
                    for name in node.names:
                        ast_result["imports"].append({
                            "name": f"{node.module}.{name.name}" if node.module else name.name,
                            "alias": name.asname
                        })
                        
            # Extract functions
            for node in tree.body:
                if isinstance(node, ast.FunctionDef):
                    ast_result["functions"].append({
                        "name": node.name,
                        "line": node.lineno,
                        "args": [arg.arg for arg in node.args.args],
                        "docstring": ast.get_docstring(node)
                    })
                elif isinstance(node, ast.ClassDef):
                    methods = []
                    for item in node.body:
                        if isinstance(item, ast.FunctionDef):
                            methods.append({
                                "name": item.name,
                                "line": item.lineno,
                                "args": [arg.arg for arg in item.args.args],
                                "docstring": ast.get_docstring(item)
                            })
                    
                    ast_result["classes"].append({
                        "name": node.name,
                        "line": node.lineno,
                        "bases": [base.id for base in node.bases if hasattr(base, 'id')],
                        "methods": methods,
                        "docstring": ast.get_docstring(node)
                    })
        
        elif file_path.endswith((".js", ".jsx", ".ts", ".tsx")):
            # Use Claude to parse JavaScript/TypeScript
            claude_client = ClaudeClient(analyzer)
            prompt = f"""Analyze this code file and extract:
1. All function definitions with their names, parameters, and start line numbers
2. All class definitions with their names, methods, and inheritance
3. All import statements

Format the output as valid JSON with these fields:
- functions: array of {{"name": string, "line": number, "args": [string], "docstring": string or null}}
- classes: array of {{"name": string, "line": number, "methods": [same as functions], "bases": [string]}}
- imports: array of {{"name": string, "alias": string or null}}

Here's the code to analyze:
```
{content}
```
"""
            response = claude_client.client.messages.create(
                model=claude_client.model_name,
                max_tokens=2000,
                system="You are a code structure analyzer. Extract code structure information from the provided file. Output ONLY valid JSON.",
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Extract JSON response from Claude
            try:
                import re
                text = response.content[0].text
                # Extract JSON part of response using regex
                match = re.search(r'```json\n(.*?)\n```', text, re.DOTALL)
                if match:
                    json_text = match.group(1)
                else:
                    json_text = text
                
                parsed = json.loads(json_text)
                ast_result.update(parsed)
            except Exception as e:
                logger.error(f"Error parsing Claude AST response: {e}")
                ast_result["error"] = "Failed to parse code structure"
            
        else:
            ast_result["error"] = "Unsupported file type for AST analysis"
    
    except Exception as e:
        logger.error(f"Error in AST analysis: {e}")
        ast_result["error"] = str(e)
    
    return ast_result

@app.post("/api/technical-debt")
async def calculate_technical_debt(request: Dict[str, Any] = Body(...)):
    """Calculate technical debt score for a repository."""
    repo_url = request.get("repo_url")
    access_token = request.get("access_token")
    
    if not repo_url:
        raise HTTPException(status_code=400, detail="repo_url is required")
    
    # Check if repo is already cached
    if repo_url not in repo_cache:
        # Analyze repo if not cached
        await fetch_and_analyze_repo(repo_url, access_token)
    
    analyzer = repo_cache[repo_url]["analyzer"]
    
    # Create a technical debt calculator
    technical_debt = {
        "repository": os.path.basename(analyzer.repo.working_dir),
        "score": 0.0,
        "metrics": {
            "code_complexity": 0.0,
            "documentation": 0.0,
            "test_coverage": 0.0,
            "code_duplication": 0.0,
            "outdated_dependencies": 0.0
        },
        "files": []
    }
    
    # Use Claude to analyze complexity
    claude_client = ClaudeClient(analyzer)
    
    # Sample a subset of files for analysis
    analyzable_extensions = ('.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cpp', '.cs')
    files_to_analyze = [
        path for path in analyzer.file_contents.keys() 
        if path.endswith(analyzable_extensions) and len(analyzer.file_contents[path]) > 0
    ]
    
    # Cap at 20 files for performance
    import random
    if len(files_to_analyze) > 20:
        files_to_analyze = random.sample(files_to_analyze, 20)
    
    total_complexity = 0.0
    file_complexities = []
    
    # Analyze each file
    for file_path in files_to_analyze:
        try:
            metrics = claude_client.analyze_code_complexity(file_path)
            if not isinstance(metrics, dict) or "error" in metrics:
                continue
                
            complexity = metrics.get("metrics", {}).get("cyclomatic_complexity", 0)
            maintainability = metrics.get("metrics", {}).get("maintainability_index", 0)
            
            # Add to total
            total_complexity += complexity
            
            # Store file metrics
            file_complexities.append({
                "file": file_path,
                "complexity": complexity,
                "maintainability": maintainability
            })
        except Exception as e:
            logger.error(f"Error analyzing file {file_path}: {e}")
    
    # Calculate average complexity
    avg_complexity = total_complexity / len(file_complexities) if file_complexities else 0
    
    # Sort files by complexity (highest first)
    file_complexities.sort(key=lambda x: x["complexity"], reverse=True)
    
    # Calculate overall technical debt score (0-100, higher means more debt)
    technical_debt["metrics"]["code_complexity"] = min(100, avg_complexity * 10)  # Scale appropriately
    
    # Find documentation level
    documentation_files = [
        path for path in analyzer.file_contents.keys() 
        if path.lower().endswith(('.md', '.rst', '.txt')) or "doc" in path.lower()
    ]
    doc_ratio = len(documentation_files) / len(analyzer.file_contents) if analyzer.file_contents else 0
    technical_debt["metrics"]["documentation"] = max(0, 100 - (doc_ratio * 500))  # Higher score means worse docs
    
    # Find test coverage approximation
    test_files = [
        path for path in analyzer.file_contents.keys() 
        if "test" in path.lower() or path.lower().endswith(('_test.py', '.test.js', 'spec.js', 'test_'))
    ]
    test_ratio = len(test_files) / len(analyzer.file_contents) if analyzer.file_contents else 0
    technical_debt["metrics"]["test_coverage"] = max(0, 100 - (test_ratio * 500))  # Higher score means worse testing
    
    # Overall score (weighted average)
    technical_debt["score"] = (
        technical_debt["metrics"]["code_complexity"] * 0.4 +
        technical_debt["metrics"]["documentation"] * 0.3 +
        technical_debt["metrics"]["test_coverage"] * 0.3
    )
    
    # Add the top 10 most complex files
    technical_debt["files"] = file_complexities[:10]
    
    return technical_debt

@app.post("/api/file-content-at-commit")
async def get_file_content_at_commit(request: Dict[str, str] = Body(...)):
    """Get file content at a specific commit."""
    repo_url = request.get("repo_url")
    file_path = request.get("file_path") 
    commit_hash = request.get("commit_hash")
    access_token = request.get("access_token")
    
    if not repo_url or not file_path or not commit_hash:
        raise HTTPException(status_code=400, detail="repo_url, file_path, and commit_hash are required")
    
    try:
        # Check if repo is already cached
        if repo_url not in repo_cache:
            # Analyze repo if not cached (will be a blocking operation here)
            await fetch_and_analyze_repo(repo_url, access_token)
        
        repo_dir = repo_cache[repo_url]["path"]
        
        # Initialize git repo
        repo = Repo(repo_dir)
        
        try:
            # Try to get the commit - if not found, try to fetch it
            try:
                commit = repo.commit(commit_hash)
            except Exception:
                # If commit isn't found, try to fetch it specifically
                logger.info(f"Commit {commit_hash} not found for file retrieval, attempting to fetch it")
                try:
                    with repo.git.custom_environment(GIT_TERMINAL_PROMPT="0"):
                        repo.git.fetch("origin", commit_hash)
                    # Now try to get the commit again
                    commit = repo.commit(commit_hash)
                except Exception as e:
                    return {
                        "status": "error", 
                        "message": f"Could not fetch commit {commit_hash}: {str(e)}"
                    }
            
            # Get the content of the file at that commit
            try:
                content = commit.tree[file_path].data_stream.read().decode('utf-8', errors='replace')
                
                return {
                    "status": "success",
                    "file_path": file_path,
                    "commit_hash": commit_hash,
                    "content": content
                }
            except KeyError:
                # File might not exist at this commit
                return {
                    "status": "error", 
                    "message": f"File {file_path} not found in commit {commit_hash}"
                }
            except Exception as e:
                logger.error(f"Error accessing file at commit: {e}", exc_info=True)
                return {"status": "error", "message": str(e)}
                
        except Exception as e:
            logger.error(f"Error accessing file at commit: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}
            
    except Exception as e:
        logger.error(f"Error getting file content at commit: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

@app.post("/api/commit-by-hash")
async def get_commit_by_hash(request: Dict[str, str] = Body(...)):
    """
    Get detailed information about a specific commit by its hash.
    """
    repo_url = request.get("repo_url")
    commit_hash = request.get("commit_hash")
    access_token = request.get("access_token")
    
    # Clean the commit hash - handle spaces and multiple hashes
    if commit_hash:
        # Take only the first segment if multiple are provided (split by spaces)
        commit_hash = commit_hash.split()[0].strip()
    
    logger.info(f"Looking up commit by hash: {commit_hash} for repo: {repo_url}")
    
    if not repo_url or not commit_hash:
        raise HTTPException(status_code=400, detail="Repository URL and commit hash are required")
    
    # Create a background task for long-running operations
    async def fetch_commit_info():
        try:
            # Check if we already have this repo in cache
            if repo_url in repo_cache:
                repo_analyzer = repo_cache[repo_url]["analyzer"]
                logger.info(f"Found repo in cache: {repo_url}")
            else:
                logger.info(f"Repo not in cache, cloning: {repo_url}")
                # Clone and analyze if needed
                try:
                    clone_dir = os.path.join(tempfile.gettempdir(), f"reposage_{uuid.uuid4().hex}")
                    os.makedirs(clone_dir, exist_ok=True)
                    
                    # Clone the repository
                    if access_token:
                        parsed_url = repo_url.strip('/')
                        if parsed_url.startswith('https://github.com/'):
                            auth_url = f"https://{access_token}@github.com/{'/'.join(parsed_url.split('/')[3:])}"
                        else:
                            auth_url = repo_url  # Not a GitHub URL or unexpected format
                    else:
                        auth_url = repo_url
                        
                    logger.info(f"Cloning repository: {repo_url} to {clone_dir}")
                    repo = Repo.clone_from(auth_url, clone_dir, depth=200)  # Use depth to speed up clone
                    
                    # Create analyzer
                    repo_analyzer = RepoAnalyzer(clone_dir)
                    
                    # Cache for future use
                    repo_cache[repo_url] = {
                        "analyzer": repo_analyzer,
                        "path": clone_dir,
                        "timestamp": datetime.now()
                    }
                except Exception as e:
                    logger.error(f"Error cloning or analyzing repository: {e}")
                    return {
                        "status": "error",
                        "message": f"Error processing repository: {str(e)}"
                    }
            
            # Get the commit details
            logger.info(f"Getting commit details for hash: {commit_hash}")
            
            # Use asyncio.wait_for to set a timeout
            commit_info = repo_analyzer.get_commit_by_hash(commit_hash)
            
            if not commit_info:
                logger.warning(f"Commit {commit_hash} not found")
                return {
                    "status": "error",
                    "message": f"Commit {commit_hash} not found. Please check the hash and try again."
                }
            
            logger.info(f"Successfully retrieved commit: {commit_info.get('short_hash')}")
            return {
                "status": "success",
                "commit": commit_info
            }
        except Exception as e:
            logger.error(f"Error retrieving commit by hash: {e}", exc_info=True)
            return {
                "status": "error",
                "message": f"Error retrieving commit: {str(e)}"
            }
    
    # Execute the background task with a timeout
    try:
        # Use a higher timeout for commit lookup
        timeout_seconds = 30
        result = await asyncio.wait_for(fetch_commit_info(), timeout=timeout_seconds)
        return result
    except asyncio.TimeoutError:
        logger.error(f"Timeout exceeded ({timeout_seconds}s) when retrieving commit {commit_hash}")
        return {
            "status": "error",
            "message": f"Request timed out. The commit lookup is taking too long. Try with a more recent or common commit hash."
        }

@app.post("/api/file-diff")
async def get_file_diff(request: Dict[str, str] = Body(...)):
    """
    Get the diff for a specific file in a commit.
    """
    repo_url = request.get("repo_url")
    commit_hash = request.get("commit_hash")
    file_path = request.get("file_path")
    access_token = request.get("access_token")
    
    if not repo_url or not commit_hash or not file_path:
        raise HTTPException(status_code=400, 
                           detail="Repository URL, commit hash, and file path are required")
    
    # Check if we already have this repo in cache
    if repo_url in repo_cache:
        repo_analyzer = repo_cache[repo_url]["analyzer"]
    else:
        # Clone and analyze if needed
        try:
            clone_dir = os.path.join(tempfile.gettempdir(), f"reposage_{uuid.uuid4().hex}")
            os.makedirs(clone_dir, exist_ok=True)
            
            # Clone the repository
            if access_token:
                parsed_url = repo_url.strip('/')
                if parsed_url.startswith('https://github.com/'):
                    auth_url = f"https://{access_token}@github.com/{'/'.join(parsed_url.split('/')[3:])}"
                else:
                    auth_url = repo_url  # Not a GitHub URL or unexpected format
            else:
                auth_url = repo_url
                
            logger.info(f"Cloning repository: {repo_url} to {clone_dir}")
            Repo.clone_from(auth_url, clone_dir)
            
            # Create analyzer
            repo_analyzer = RepoAnalyzer(clone_dir)
            
            # Cache for future use
            repo_cache[repo_url] = {
                "analyzer": repo_analyzer,
                "clone_dir": clone_dir,
                "timestamp": datetime.now()
            }
        except Exception as e:
            logger.error(f"Error cloning or analyzing repository: {e}")
            raise HTTPException(status_code=500, detail=f"Error processing repository: {str(e)}")
    
    # Get the file diff
    diff_text = repo_analyzer.get_file_diff(commit_hash, file_path)
    
    return {"diff": diff_text}

@app.post("/api/analyze-file-content")
async def analyze_file_content(request: Dict[str, str] = Body(...)):
    """
    Analyze file content in detail to extract functions, classes and their implementations.
    This provides more detailed information than the AST analysis.
    """
    repo_url = request.get("repo_url")
    file_path = request.get("file_path")
    access_token = request.get("access_token")
    
    if not repo_url or not file_path:
        raise HTTPException(status_code=400, detail="repo_url and file_path are required")
    
    # Check if repo is already cached
    if repo_url not in repo_cache:
        # Analyze repo if not cached
        await fetch_and_analyze_repo(repo_url, access_token)
    
    # Get file content
    analyzer = repo_cache[repo_url]["analyzer"]
    content = analyzer.file_contents.get(file_path)
    
    if not content:
        raise HTTPException(status_code=404, detail=f"File {file_path} not found in repository")
    
    # Extract file extension
    _, extension = os.path.splitext(file_path)
    extension = extension.lower()
    
    result = {
        "file_path": file_path,
        "functions": [],
        "classes": [],
        "variables": [],
        "code_segments": {}
    }
    
    try:
        if extension == '.py':
            # Python file analysis
            import ast
            
            # Parse the AST
            tree = ast.parse(content)
            
            # Helper function to get source line ranges for nodes
            def get_node_lines(node):
                if hasattr(node, 'end_lineno'):
                    # Python 3.8+ has end_lineno
                    return node.lineno, node.end_lineno
                
                # For older Python versions, estimate the end line
                content_lines = content.splitlines()
                start_line = node.lineno
                # Get source code for the node
                if isinstance(node, ast.ClassDef) or isinstance(node, ast.FunctionDef):
                    # Include decorator lines
                    if node.decorator_list:
                        start_line = min(d.lineno for d in node.decorator_list)
                
                # Rough estimation of end line for older Python versions
                end_line = start_line
                for i in range(start_line, len(content_lines) + 1):
                    if i >= len(content_lines):
                        break
                    line = content_lines[i-1].strip()
                    end_line = i
                    
                    # Check for indentation level to find the end of the function/class
                    if i > start_line and (not line or line.startswith('def ') or line.startswith('class ')):
                        if not line or line[0] not in ' \t':  # No indentation means end of block
                            end_line = i - 1
                            break
                
                return start_line, end_line
            
            # Extract functions and their source code
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    start_line, end_line = get_node_lines(node)
                    function_code = "\n".join(content.splitlines()[start_line-1:end_line])
                    
                    function_info = {
                        "name": node.name,
                        "line_start": start_line,
                        "line_end": end_line,
                        "args": [arg.arg for arg in node.args.args],
                        "docstring": ast.get_docstring(node),
                        "code_id": f"func_{node.name}_{start_line}"
                    }
                    result["functions"].append(function_info)
                    result["code_segments"][function_info["code_id"]] = function_code
                
                elif isinstance(node, ast.ClassDef):
                    start_line, end_line = get_node_lines(node)
                    class_code = "\n".join(content.splitlines()[start_line-1:end_line])
                    
                    methods = []
                    for item in node.body:
                        if isinstance(item, ast.FunctionDef):
                            method_start, method_end = get_node_lines(item)
                            method_code = "\n".join(content.splitlines()[method_start-1:method_end])
                            
                            method_info = {
                                "name": item.name,
                                "line_start": method_start,
                                "line_end": method_end,
                                "args": [arg.arg for arg in item.args.args],
                                "docstring": ast.get_docstring(item),
                                "code_id": f"method_{node.name}_{item.name}_{method_start}"
                            }
                            methods.append(method_info)
                            result["code_segments"][method_info["code_id"]] = method_code
                    
                    class_info = {
                        "name": node.name,
                        "line_start": start_line,
                        "line_end": end_line,
                        "bases": [base.id for base in node.bases if hasattr(base, 'id')],
                        "methods": methods,
                        "docstring": ast.get_docstring(node),
                        "code_id": f"class_{node.name}_{start_line}"
                    }
                    result["classes"].append(class_info)
                    result["code_segments"][class_info["code_id"]] = class_code
                
                elif isinstance(node, ast.Assign):
                    # Extract top-level variables
                    if node.lineno == node.end_lineno if hasattr(node, 'end_lineno') else True:
                        for target in node.targets:
                            if isinstance(target, ast.Name):
                                var_line = node.lineno
                                var_code = content.splitlines()[var_line-1]
                                
                                result["variables"].append({
                                    "name": target.id,
                                    "line": var_line,
                                    "code_id": f"var_{target.id}_{var_line}"
                                })
                                result["code_segments"][f"var_{target.id}_{var_line}"] = var_code
        
        elif extension in ['.js', '.jsx', '.ts', '.tsx']:
            # For JavaScript/TypeScript, use Claude to extract structure
            claude_client = ClaudeClient(analyzer)
            
            prompt = f"""Analyze this code file and extract detailed information about:
1. All function definitions with their complete implementations
2. All class definitions with their complete method implementations
3. Important variable declarations

Format your response as valid JSON with these sections:
- functions: array of objects with name, line_start, line_end, args (array), and complete code
- classes: array of objects with name, line_start, line_end, methods (array of same structure as functions)
- variables: array of important variable declarations

Include the actual source code for each function, method, and class.

Here's the code to analyze:
```
{content}
```
"""
            response = claude_client.client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=8000,
                system="You are a code structure analyzer. Extract detailed code structure information from the provided file and format it as valid JSON.",
                messages=[{"role": "user", "content": prompt}]
            )
            
            try:
                import re
                text = response.content[0].text
                
                # Extract JSON part of response
                match = re.search(r'```json\n(.*?)\n```', text, re.DOTALL)
                if match:
                    json_text = match.group(1)
                else:
                    # Try without json prefix
                    match = re.search(r'```\n(.*?)\n```', text, re.DOTALL)
                    if match:
                        json_text = match.group(1)
                    else:
                        json_text = text
                
                parsed = json.loads(json_text)
                
                # Process functions
                if "functions" in parsed:
                    for i, func in enumerate(parsed["functions"]):
                        code_id = f"func_{func['name']}_{func.get('line_start', i)}"
                        func["code_id"] = code_id
                        if "code" in func:
                            result["code_segments"][code_id] = func["code"]
                            del func["code"]
                        result["functions"].append(func)
                
                # Process classes
                if "classes" in parsed:
                    for i, cls in enumerate(parsed["classes"]):
                        code_id = f"class_{cls['name']}_{cls.get('line_start', i)}"
                        cls["code_id"] = code_id
                        if "code" in cls:
                            result["code_segments"][code_id] = cls["code"]
                            del cls["code"]
                        
                        # Process methods
                        if "methods" in cls:
                            for j, method in enumerate(cls["methods"]):
                                method_code_id = f"method_{cls['name']}_{method['name']}_{method.get('line_start', j)}"
                                method["code_id"] = method_code_id
                                if "code" in method:
                                    result["code_segments"][method_code_id] = method["code"]
                                    del method["code"]
                        
                        result["classes"].append(cls)
                
                # Process variables
                if "variables" in parsed:
                    for i, var in enumerate(parsed["variables"]):
                        code_id = f"var_{var['name']}_{var.get('line', i)}"
                        var["code_id"] = code_id
                        if "code" in var:
                            result["code_segments"][code_id] = var["code"]
                            del var["code"]
                        result["variables"].append(var)
            
            except Exception as e:
                logger.error(f"Error parsing Claude analysis response: {e}")
                result["error"] = f"Failed to parse code structure: {str(e)}"
        
        else:
            # For other file types, provide basic info
            result["content"] = content
            result["error"] = f"Detailed analysis not available for {extension} files"
    
    except Exception as e:
        logger.error(f"Error in file content analysis: {e}")
        result["error"] = str(e)
    
    return result

# Authentication helper functions
def verify_password(plain_password, hashed_password):
    """Verify that the plain password matches the hashed password."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Generate password hash."""
    return pwd_context.hash(password)

def authenticate_user(db: Session, username: str, password: str):
    """Authenticate user with username and password."""
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(security_scopes: SecurityScopes, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Get current user from token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Security(get_current_user, scopes=["user"])):
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# User schema models
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    is_admin: bool
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    scopes: List[str] = []

# User authentication endpoints
@app.post("/api/register", response_model=UserResponse)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    db_user = db.query(User).filter(
        (User.email == user.email) | (User.username == user.username)
    ).first()
    if db_user:
        if db_user.email == user.email:
            raise HTTPException(status_code=400, detail="Email already registered")
        else:
            raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Generate access token for user login."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "scopes": ["user"]}, 
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user info."""
    return current_user

@app.post("/api/apikeys")
async def create_api_key(
    key_name: str = Body(...), 
    service: str = Body(...), 
    key_value: str = Body(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Store an encrypted API key for a service."""
    # Generate a key prefix for identification (first 4 chars)
    key_prefix = key_value[:4]
    
    # Hash the key for verification
    hashed_key = get_password_hash(key_value)
    
    # Encrypt the full key for storage
    encrypted_key = fernet.encrypt(key_value.encode()).decode()
    
    # Create the API key entry
    api_key = ApiKey(
        key_name=key_name,
        key_prefix=key_prefix,
        hashed_key=hashed_key,
        encrypted_key=encrypted_key,
        service=service,
        user_id=current_user.id
    )
    
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    return {"status": "success", "message": f"API key '{key_name}' created successfully"}

# The endpoint to replace the existing /api/chat endpoint
@app.post("/api/chat/debug")
async def debug_chat_endpoint(request: Request):
    """
    Debug endpoint that accepts any JSON payload without strict validation.
    
    This endpoint helps diagnose 422 Unprocessable Entity errors by:
    1. Accepting any JSON data without Pydantic validation
    2. Logging the full request data
    3. Returning a response confirming receipt
    """
    # Log that we're using the debug endpoint
    logger.info("Using debug chat endpoint to bypass validation")
    
    try:
        # Parse the raw JSON from the request
        data = await request.json()
        
        # Log detailed information about the request
        logger.info(f"Received data: {json.dumps(data, indent=2)}")
        
        # Extract key information if available
        repo_url = data.get("repo_url", "No repo URL provided")
        messages = data.get("messages", [])
        model_name = data.get("model_name", "models/gemini-2.0-flash")  # Default model
        
        message_count = len(messages)
        model_info = f"Model: {model_name}, Provider: {data.get('model_provider', 'default')}"
        
        logger.info(f"Request info - Repo: {repo_url}, Messages: {message_count}, {model_info}")
        
        # Check if repo is already cached
        if repo_url in repo_cache:
            logger.info(f"Repository {repo_url} found in cache")
            try:
                # Create Gemini client with repo analysis
                gemini_client = GeminiClient(repo_cache[repo_url]["analyzer"], model_name=model_name)
                
                logger.info(f"Attempting to generate a response with {model_name}")
                
                # Process the chat messages
                try:
                    response = await gemini_client.chat(messages)
                    return {
                        "status": "success",
                        "response": response
                    }
                except Exception as e:
                    logger.error(f"Error in chat processing: {e}")
                    return {
                        "status": "error",
                        "message": f"Error processing chat: {str(e)}",
                        "data_received": data
                    }
            except Exception as e:
                logger.error(f"Error creating Gemini client: {e}")
                return {
                    "status": "error",
                    "message": f"Repository found in cache, but error creating client: {str(e)}",
                    "data_received": data
                }
        else:
            # If repo is not cached, just return confirmation
            return {
                "status": "success",
                "message": "Debug endpoint received your data successfully, but repository is not cached",
                "data_received": data
            }
    
    except Exception as e:
        # Log any errors that occur
        logger.error(f"Error in debug endpoint: {str(e)}")
        return {
            "status": "error",
            "message": f"Error processing request: {str(e)}",
            "note": "This endpoint should accept any JSON data - if you're seeing this error, there might be an issue with your JSON format"
        }

@app.post("/api/search-code-element")
async def search_code_element(request: Dict[str, str] = Body(...)):
    """
    Search for a specific function, class, or other code element across the codebase.
    """
    repo_url = request.get("repo_url")
    element_name = request.get("element_name")
    element_type = request.get("element_type", "any")  # function, class, method, or any
    access_token = request.get("access_token")
    
    if not repo_url or not element_name:
        raise HTTPException(status_code=400, detail="repo_url and element_name are required")
    
    # Check if repo is already cached
    if repo_url not in repo_cache:
        # Analyze repo if not cached
        await fetch_and_analyze_repo(repo_url, access_token)
    
    # Get repo analyzer
    analyzer = repo_cache[repo_url]["analyzer"]
    
    # Results container
    results = {
        "element_name": element_name,
        "matches": []
    }
    
    # Search through all files
    for file_path, content in analyzer.file_contents.items():
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # For Python files, use AST parsing for accurate results
        if file_ext == '.py':
            try:
                import ast
                tree = ast.parse(content)
                
                # Helper function to get source line ranges for nodes
                def get_node_lines(node):
                    if hasattr(node, 'end_lineno'):
                        # Python 3.8+ has end_lineno
                        return node.lineno, node.end_lineno
                    
                    # For older Python versions, estimate the end line
                    content_lines = content.splitlines()
                    start_line = node.lineno
                    # Rough estimation of end line for older Python versions
                    end_line = start_line
                    for i in range(start_line, len(content_lines) + 1):
                        if i >= len(content_lines):
                            break
                        line = content_lines[i-1].strip()
                        end_line = i
                        
                        # Check for indentation level to find the end of the function/class
                        if i > start_line and (not line or line.startswith('def ') or line.startswith('class ')):
                            if not line or line[0] not in ' \t':  # No indentation means end of block
                                end_line = i - 1
                                break
                
                    return start_line, end_line
                
                # Look for functions/methods matching the element name
                if element_type in ["function", "any"]:
                    for node in ast.walk(tree):
                        if isinstance(node, ast.FunctionDef) and node.name == element_name:
                            # Get function source
                            start_line, end_line = get_node_lines(node)
                            source_lines = content.splitlines()[start_line-1:end_line]
                            
                            results["matches"].append({
                                "type": "function",
                                "file": file_path,
                                "line_start": start_line,
                                "line_end": end_line,
                                "signature": f"def {node.name}({', '.join(arg.arg for arg in node.args.args)})",
                                "docstring": ast.get_docstring(node),
                                "source": "\n".join(source_lines)
                            })
                
                # Look for classes matching the element name
                if element_type in ["class", "any"]:
                    for node in ast.walk(tree):
                        if isinstance(node, ast.ClassDef) and node.name == element_name:
                            # Get class source
                            start_line, end_line = get_node_lines(node)
                            source_lines = content.splitlines()[start_line-1:end_line]
                            
                            # Get methods
                            methods = []
                            for item in node.body:
                                if isinstance(item, ast.FunctionDef):
                                    method_start, method_end = get_node_lines(item)
                                    methods.append({
                                        "name": item.name,
                                        "line_start": method_start,
                                        "line_end": method_end,
                                        "signature": f"def {item.name}({', '.join(arg.arg for arg in item.args.args)})"
                                    })
                            
                            results["matches"].append({
                                "type": "class",
                                "file": file_path,
                                "line_start": start_line,
                                "line_end": end_line,
                                "methods": methods,
                                "docstring": ast.get_docstring(node),
                                "source": "\n".join(source_lines)
                            })
                
                # Look for methods in classes
                if element_type in ["method", "any"]:
                    for node in ast.walk(tree):
                        if isinstance(node, ast.ClassDef):
                            for item in node.body:
                                if isinstance(item, ast.FunctionDef) and item.name == element_name:
                                    # Get method source
                                    method_start, method_end = get_node_lines(item)
                                    method_source = "\n".join(content.splitlines()[method_start-1:method_end])
                                    
                                    results["matches"].append({
                                        "type": "method",
                                        "class": node.name,
                                        "file": file_path,
                                        "line_start": method_start,
                                        "line_end": method_end,
                                        "signature": f"def {item.name}({', '.join(arg.arg for arg in item.args.args)})",
                                        "docstring": ast.get_docstring(item),
                                        "source": method_source
                                    })
            except Exception as e:
                logger.error(f"Error parsing Python file {file_path}: {e}")
        
        # For other file types, use regex pattern matching
        else:
            lines = content.splitlines()
            
            # Look for possible matches using regex
            if element_type in ["function", "any"]:
                for i, line in enumerate(lines):
                    if re.search(fr'\bfunction\s+{re.escape(element_name)}\b|\b{re.escape(element_name)}\s*[:=]\s*function\b|\bdef\s+{re.escape(element_name)}\b', line, re.IGNORECASE):
                        # Extract context (~20 lines)
                        context_start = max(0, i-1)
                        context_end = min(len(lines), i+20)
                        source = "\n".join(lines[context_start:context_end])
                        
                        results["matches"].append({
                            "type": "function",
                            "file": file_path,
                            "line_start": i+1,
                            "signature": line.strip(),
                            "source": source
                        })
            
            if element_type in ["class", "any"]:
                for i, line in enumerate(lines):
                    if re.search(fr'\bclass\s+{re.escape(element_name)}\b', line, re.IGNORECASE):
                        # Extract more context for classes (~50 lines)
                        context_start = max(0, i-1)
                        context_end = min(len(lines), i+50)
                        source = "\n".join(lines[context_start:context_end])
                        
                        results["matches"].append({
                            "type": "class",
                            "file": file_path,
                            "line_start": i+1,
                            "signature": line.strip(),
                            "source": source
                        })
    
    return results

async def validate_git_repo(repo_url: str, access_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Validate if a URL is a valid Git repository without cloning it.
    Returns a dictionary with validation status and details.
    """
    import requests
    from git.exc import GitCommandError
    import subprocess
    import re
    import asyncio
    from functools import partial
    
    result = {
        "valid": False,
        "reason": None,
        "details": None
    }
    
    # Basic URL validation
    if not repo_url or not isinstance(repo_url, str):
        result["reason"] = "Invalid URL format"
        return result
    
    # Remove trailing slashes for consistency
    repo_url = repo_url.rstrip('/')
    
    # Check if it's a GitHub URL
    github_pattern = r'https://github\.com/([^/]+)/([^/]+)/?'
    match = re.match(github_pattern, repo_url)
    
    if match:
        # GitHub-specific validation
        owner, repo_name = match.groups()
        
        # Construct API URL
        api_url = f"https://api.github.com/repos/{owner}/{repo_name}"
        
        # Set up headers with auth token if provided
        headers = {}
        if access_token:
            headers["Authorization"] = f"token {access_token}"
        
        try:
            # Check if repo exists via GitHub API - use a shorter timeout
            response = requests.get(api_url, headers=headers, timeout=5)
            
            if response.status_code == 200:
                repo_data = response.json()
                result["valid"] = True
                result["details"] = {
                    "name": repo_data.get("name"),
                    "full_name": repo_data.get("full_name"),
                    "description": repo_data.get("description"),
                    "default_branch": repo_data.get("default_branch"),
                    "stars": repo_data.get("stargazers_count"),
                    "forks": repo_data.get("forks_count"),
                    "size": repo_data.get("size")
                }
            elif response.status_code == 404:
                result["reason"] = "Repository not found"
            elif response.status_code == 403:
                result["reason"] = "API rate limit exceeded or insufficient permissions"
            else:
                result["reason"] = f"GitHub API error: {response.status_code}"
                
            return result
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"GitHub API request error: {str(e)}")
            result["reason"] = f"Connection error: {str(e)}"
            
            # Fall through to git ls-remote as a backup validation method
    
    # For non-GitHub URLs or as a fallback, try git ls-remote with asyncio to handle timeouts better
    try:
        # Prepare the git command
        git_url = repo_url
        if access_token and git_url.startswith('https://'):
            # Add token to URL for private repos
            git_url = git_url.replace('https://', f'https://{access_token}@')
        
        # Create a function to run git ls-remote in a separate process
        async def run_git_ls_remote():
            loop = asyncio.get_event_loop()
            try:
                # Use a shorter timeout to avoid long waits
                process = await loop.run_in_executor(
                    None, 
                    partial(
                        subprocess.run,
                        ["git", "ls-remote", git_url, "HEAD"],
                        capture_output=True,
                        text=True,
                        timeout=8  # 8 second timeout
                    )
                )
                
                # Check if the command was successful
                if process.returncode == 0:
                    result["valid"] = True
                    # Extract the HEAD commit hash
                    if process.stdout.strip():
                        commit_hash = process.stdout.split()[0]
                        result["details"] = {
                            "head_commit": commit_hash
                        }
                else:
                    result["reason"] = f"Git error: {process.stderr.strip()}"
                
                return result
            except subprocess.TimeoutExpired:
                result["reason"] = "Timeout while validating repository"
                return result
            except Exception as e:
                result["reason"] = f"Error validating repository: {str(e)}"
                return result
        
        # Run with asyncio timeout
        try:
            # Use a slightly longer timeout for the overall operation
            return await asyncio.wait_for(run_git_ls_remote(), timeout=10)
        except asyncio.TimeoutError:
            result["reason"] = "The repository validation timed out. The server might be unreachable."
            return result
        
    except Exception as e:
        logger.error(f"Error in validate_git_repo: {str(e)}", exc_info=True)
        result["reason"] = f"Error validating repository: {str(e)}"
    
    return result

@app.post("/api/validate-repo")
async def validate_repository(repo_request: RepoRequest):
    """
    Validate a repository URL before attempting to clone it.
    """
    repo_url = repo_request.repo_url
    access_token = repo_request.access_token
    
    # Validate the repository URL
    validation_result = await validate_git_repo(repo_url, access_token)
    
    if validation_result["valid"]:
        return {
            "status": "success",
            "valid": True,
            "details": validation_result["details"]
        }
    else:
        return {
            "status": "failed",
            "valid": False,
            "reason": validation_result["reason"]
        }

if __name__ == "__main__":
    # Run server
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True) 