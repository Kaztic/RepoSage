import os
import json
import time
from typing import List, Dict, Any, Optional
import weaviate
from weaviate.util import generate_uuid5
import google.generativeai as genai
from langchain_anthropic import ChatAnthropic
from langchain.schema import HumanMessage, SystemMessage
from app.config import settings
from app.models import ChatMessage, Repository
from app.database import get_db
from app.utils import get_repo_files, get_file_content, get_repo_metadata
from app.celery_app import celery_app
from app.weaviate_client import get_weaviate_client

# Initialize Weaviate client
weaviate_client = get_weaviate_client()

# Initialize Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)
gemini_model = genai.GenerativeModel('gemini-pro')

# Initialize Anthropic
anthropic = ChatAnthropic(
    model="claude-3-sonnet-20240229",
    anthropic_api_key=settings.ANTHROPIC_API_KEY
)

def get_relevant_files(repo_path: str, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Get relevant files using Weaviate semantic search."""
    try:
        # Search in Weaviate
        response = weaviate_client.query.get(
            "RepositoryFile",
            ["file_path", "content", "embedding"]
        ).with_near_text({
            "concepts": [query]
        }).with_limit(top_k).do()

        if response and "data" in response and "Get" in response["data"]:
            results = response["data"]["Get"]["RepositoryFile"]
            return [{
                "file_path": result["file_path"],
                "content": result["content"]
            } for result in results]
        
        return []
    except Exception as e:
        print(f"Error in Weaviate search: {str(e)}")
        return []

def get_relevant_code_snippets(repo_path: str, query: str, top_k: int = 5) -> str:
    """Get relevant code snippets using Weaviate semantic search."""
    relevant_files = get_relevant_files(repo_path, query, top_k)
    
    if not relevant_files:
        return "No relevant code found."
    
    snippets = []
    for file in relevant_files:
        snippets.append(f"File: {file['file_path']}\n```\n{file['content']}\n```")
    
    return "\n\n".join(snippets)

def get_codebase_context(repo_path: str) -> str:
    """Get codebase context using Weaviate."""
    try:
        # Get repository metadata
        metadata = get_repo_metadata(repo_path)
        
        # Get all files from Weaviate
        response = weaviate_client.query.get(
            "RepositoryFile",
            ["file_path", "content"]
        ).with_where({
            "path": ["repository_id"],
            "operator": "Equal",
            "valueString": metadata["id"]
        }).do()

        if response and "data" in response and "Get" in response["data"]:
            files = response["data"]["Get"]["RepositoryFile"]
            return "\n".join([f"File: {f['file_path']}\n```\n{f['content']}\n```" for f in files])
        
        return "No files found in the repository."
    except Exception as e:
        print(f"Error getting codebase context: {str(e)}")
        return "Error retrieving codebase context."

def get_repo_summary(repo_path: str) -> str:
    """Get repository summary using Weaviate and LLM."""
    try:
        # Get repository metadata
        metadata = get_repo_metadata(repo_path)
        
        # Get all files from Weaviate
        response = weaviate_client.query.get(
            "RepositoryFile",
            ["file_path", "content"]
        ).with_where({
            "path": ["repository_id"],
            "operator": "Equal",
            "valueString": metadata["id"]
        }).do()

        if not response or "data" not in response or "Get" not in response["data"]:
            return "No files found in the repository."

        files = response["data"]["Get"]["RepositoryFile"]
        file_contents = "\n".join([f"File: {f['file_path']}\n```\n{f['content']}\n```" for f in files])

        # Use Gemini to generate summary
        prompt = f"""Please analyze this codebase and provide a comprehensive summary. Focus on:
        1. Main purpose and functionality
        2. Key components and their relationships
        3. Notable patterns or architectural decisions
        4. Dependencies and external integrations

        Codebase:
        {file_contents}"""

        response = gemini_model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Error generating repo summary: {str(e)}")
        return "Error generating repository summary."

def get_code_explanation(code: str) -> str:
    """Get explanation of code using LLM."""
    try:
        prompt = f"""Please explain this code in detail:
        ```python
        {code}
        ```

        Focus on:
        1. What the code does
        2. How it works
        3. Key algorithms or patterns used
        4. Potential edge cases or limitations"""

        response = gemini_model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Error explaining code: {str(e)}")
        return "Error explaining code."

def get_code_suggestions(code: str) -> str:
    """Get suggestions for improving code using LLM."""
    try:
        prompt = f"""Please review this code and provide suggestions for improvement:
        ```python
        {code}
        ```

        Consider:
        1. Code quality and readability
        2. Performance optimizations
        3. Security considerations
        4. Best practices
        5. Potential bugs or edge cases"""

        response = gemini_model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Error getting code suggestions: {str(e)}")
        return "Error getting code suggestions."

def get_documentation_suggestions(code: str) -> str:
    """Get suggestions for documenting code using LLM."""
    try:
        prompt = f"""Please suggest documentation for this code:
        ```python
        {code}
        ```

        Include:
        1. Function/class documentation
        2. Parameter descriptions
        3. Return value descriptions
        4. Usage examples
        5. Important notes or warnings"""

        response = gemini_model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Error getting documentation suggestions: {str(e)}")
        return "Error getting documentation suggestions."

def chat_with_repo(repo_path: str, message: str, chat_history: List[Dict[str, str]] = None) -> str:
    """Chat with the repository using Weaviate and LLM."""
    try:
        # Get relevant code snippets
        relevant_code = get_relevant_code_snippets(repo_path, message)
        
        # Prepare chat history
        history = []
        if chat_history:
            for msg in chat_history:
                if msg["role"] == "user":
                    history.append(HumanMessage(content=msg["content"]))
                else:
                    history.append(SystemMessage(content=msg["content"]))
        
        # Prepare system message
        system_message = SystemMessage(content=f"""You are a helpful AI assistant for a code repository.
        You have access to relevant code snippets that might help answer the user's question.
        
        Relevant code:
        {relevant_code}
        
        Please provide a helpful response based on the code and the user's question.
        If the code is not relevant, you can still try to help based on your general knowledge.
        Be specific and include code examples when appropriate.""")

        # Get response from Anthropic
        response = anthropic([system_message] + history + [HumanMessage(content=message)])
        return response.content
    except Exception as e:
        print(f"Error in chat_with_repo: {str(e)}")
        return "Error processing your request. Please try again."

@celery_app.task
def index_repository(repo_path: str):
    """Index repository files in Weaviate."""
    try:
        # Get repository metadata
        metadata = get_repo_metadata(repo_path)
        
        # Get all files
        files = get_repo_files(repo_path)
        
        # Index each file in Weaviate
        for file_path in files:
            content = get_file_content(os.path.join(repo_path, file_path))
            if content:
                weaviate_client.data_object.create(
                    class_name="RepositoryFile",
                    data_object={
                        "file_path": file_path,
                        "content": content,
                        "repository_id": metadata["id"]
                    },
                    uuid=generate_uuid5(file_path)
                )
    except Exception as e:
        print(f"Error indexing repository: {str(e)}")
        raise e 