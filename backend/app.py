#!/usr/bin/env python3
"""
RepoSage Backend API Server
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Request, Body
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import asyncio
import aiohttp
from github import Github
from git import Repo, GitCommandError
import numpy as np
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('reposage')

# Import RepoAnalyzer from existing chatbot module
from chatbot import RepoAnalyzer, GeminiClient

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
    model_name: Optional[str] = "models/gemini-1.5-pro"  # Add model selection option

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
    
    # Check if repo is already cached
    if repo_url not in repo_cache:
        # Start analysis in background if not cached
        background_tasks.add_task(fetch_and_analyze_repo, repo_url, access_token)
        return {"status": "processing", "message": "Repository analysis started. Try again in a few seconds."}
    
    # Return file structure
    analysis = repo_cache[repo_url]["analysis"]
    return {
        "status": "success", 
        "repo_info": analysis["repo_info"],
        "file_structure": analysis["file_structure"],
        "important_files": analysis["important_files"]
    }

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
    """Chat with repository assistant."""
    repo_url = chat_request.repo_url
    messages = chat_request.messages
    access_token = chat_request.access_token
    model_name = chat_request.model_name or "models/gemini-1.5-pro"  # Default model
    
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
            "message": response["message"],
            "relevant_files": response.get("relevant_files", []),
            "relevant_commits": response.get("relevant_commits", [])
        }
    except Exception as e:
        logger.error(f"Error in chat with repo: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

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
    """Get detailed information about a specific commit by hash."""
    repo_url = request.get("repo_url")
    commit_hash = request.get("commit_hash")
    access_token = request.get("access_token")
    
    if not repo_url or not commit_hash:
        raise HTTPException(status_code=400, detail="repo_url and commit_hash are required")
    
    try:
        # Check if repo is already cached
        if repo_url not in repo_cache:
            # Analyze repo if not cached (will be a blocking operation here)
            await fetch_and_analyze_repo(repo_url, access_token)
        
        # Get commit history from cache
        commit_history = repo_cache[repo_url]["analysis"]["commit_history"]
        
        # Search for the commit by hash (either full or short hash)
        found_commit = None
        for commit in commit_history:
            if commit["hash"].startswith(commit_hash) or commit["short_hash"] == commit_hash:
                found_commit = commit
                break
        
        if found_commit:
            return {
                "status": "success",
                "commit": found_commit
            }
        else:
            # If not found in the cached history, try to fetch directly from the repository
            repo_dir = repo_cache[repo_url]["path"]
            repo = Repo(repo_dir)
            
            try:
                # First try to fetch this commit if it's not in our shallow clone
                try:
                    # Check if commit exists before fetching
                    try:
                        commit = repo.commit(commit_hash)
                    except Exception:
                        # If commit isn't found, try to fetch it specifically
                        logger.info(f"Commit {commit_hash} not found, attempting to fetch it")
                        with repo.git.custom_environment(GIT_TERMINAL_PROMPT="0"):
                            repo.git.fetch("origin", commit_hash)
                        # Now try to get the commit again
                        commit = repo.commit(commit_hash)
                
                    # Get file changes for this commit (with safer parent handling)
                    file_changes = []
                    
                    if commit.parents:
                        # Only process parents if they exist
                        for parent in commit.parents:
                            try:
                                diff_index = parent.diff(commit)
                                for diff in diff_index:
                                    change_type = "modified"
                                    if diff.new_file:
                                        change_type = "added"
                                    elif diff.deleted_file:
                                        change_type = "deleted"
                                    elif diff.renamed:
                                        change_type = "renamed"
                                    
                                    path = diff.b_path if hasattr(diff, 'b_path') and diff.b_path else (
                                        diff.a_path if hasattr(diff, 'a_path') and diff.a_path else None
                                    )
                                    
                                    if path:
                                        file_changes.append({
                                            "path": path,
                                            "change_type": change_type,
                                            "insertions": 0,  # Would need more processing to get accurate numbers
                                            "deletions": 0
                                        })
                            except Exception as e:
                                logger.warning(f"Error processing parent diff: {e}")
                                # Continue with other parents
                    else:
                        # For commits with no parents (e.g., initial commit)
                        # Simply list the files in the commit
                        try:
                            for item in commit.tree.traverse():
                                if item.type == 'blob':  # Only include files, not directories
                                    file_changes.append({
                                        "path": item.path,
                                        "change_type": "added",  # Since it's likely the initial commit
                                        "insertions": 0,
                                        "deletions": 0
                                    })
                        except Exception as e:
                            logger.warning(f"Error getting files from commit tree: {e}")
                
                    commit_info = {
                        "hash": commit.hexsha,
                        "short_hash": commit.hexsha[:7],
                        "author": f"{commit.author.name} <{commit.author.email}>",
                        "date": datetime.fromtimestamp(commit.committed_date).isoformat(),
                        "message": commit.message.strip(),
                        "stats": {
                            "files_changed": len(file_changes),
                            "insertions": 0,
                            "deletions": 0
                        },
                        "file_changes": file_changes
                    }
                    
                    return {
                        "status": "success",
                        "commit": commit_info
                    }
                except Exception as e:
                    logger.error(f"Error accessing commit after fetch attempt: {e}", exc_info=True)
                    return {"status": "error", "message": f"Commit {commit_hash} not found or inaccessible: {str(e)}"}
            except Exception as e:
                logger.error(f"Error accessing commit directly: {e}", exc_info=True)
                return {"status": "error", "message": f"Commit {commit_hash} not found in repository"}
                
    except Exception as e:
        logger.error(f"Error getting commit by hash: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    # Run server
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True) 