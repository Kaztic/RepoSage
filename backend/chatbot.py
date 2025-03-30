#!/usr/bin/env python3
"""
RepoSage - GitHub repository chatbot using Gemini API
"""

import os
import sys
import logging
import json
import tempfile
import yaml
from typing import List, Dict, Any, Optional, Tuple
import re
from datetime import datetime

import requests
import google.generativeai as genai
from github import Github
from git import Repo
import numpy as np
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('reposage')

# Global model instance to be shared across analyzer instances
_global_sentence_transformer = None

def get_global_sentence_transformer():
    global _global_sentence_transformer
    if _global_sentence_transformer is None:
        logger.info("Initializing global sentence transformer model")
        _global_sentence_transformer = SentenceTransformer('all-MiniLM-L6-v2')
    return _global_sentence_transformer

class RepoAnalyzer:
    """Analyzes repository content and history."""
    
    def __init__(self, repo_path: str):
        self.repo = Repo(repo_path)
        self.model = get_global_sentence_transformer()  # Use shared model instance
        self.file_contents = {}
        self.file_embeddings = {}
        self.commit_history = []
        
    def analyze_repo(self) -> Dict[str, Any]:
        """Perform comprehensive repository analysis."""
        logger.info("Starting repository analysis")
        
        # Use parallel processing for faster analysis
        import concurrent.futures
        
        # First get basic info (quick operation)
        repo_info = self._get_repo_info()
        
        # Then run heavier operations in parallel
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            future_commit_history = executor.submit(self._get_commit_history)
            future_file_structure = executor.submit(self._get_file_structure)
            
            # Wait for all tasks to complete
            commit_history = future_commit_history.result()
            file_structure = future_file_structure.result()
        
        # Only run this after we have file structure
        important_files = self._identify_important_files()
        
        results = {
            "repo_info": repo_info,
            "commit_history": commit_history,
            "file_structure": file_structure,
            "important_files": important_files,
        }
        
        logger.info("Repository analysis completed")
        return results
    
    def _get_repo_info(self) -> Dict[str, str]:
        """Extract basic repository information."""
        return {
            "name": os.path.basename(self.repo.working_dir),
            "description": self._get_readme_summary(),
            "branches": [branch.name for branch in self.repo.branches],
            "default_branch": self.repo.active_branch.name,
        }
    
    def _get_readme_summary(self) -> str:
        """Extract summary from README if available."""
        readme_paths = ['README.md', 'README.rst', 'Readme.md', 'readme.md']
        for path in readme_paths:
            full_path = os.path.join(self.repo.working_dir, path)
            if os.path.exists(full_path):
                with open(full_path, 'r', encoding='utf-8') as f:
                    try:
                        content = f.read()
                        
                        # If README is very short, return the whole thing
                        if len(content) < 1500:
                            return content.strip()
                            
                        # Otherwise, extract the most relevant parts
                        # Try to identify sections using headers
                        sections = re.split(r'#{1,6}\s+', content)
                        
                        # Return first part and look for important sections
                        summary = sections[0].strip()
                        
                        # Look for key sections
                        important_keywords = ['about', 'introduction', 'overview', 'description', 'features', 'usage']
                        for i, section in enumerate(sections[1:], 1):
                            # Get section title (first line)
                            lines = section.strip().split('\n')
                            if not lines:
                                continue
                                
                            title = lines[0].lower()
                            content = '\n'.join(lines[1:]).strip()
                            
                            # Check if it's an important section
                            if any(keyword in title.lower() for keyword in important_keywords):
                                summary += f"\n\n## {title}\n{content[:500]}..."
                        
                        return summary
                    except Exception as e:
                        logger.warning(f"Error processing README: {e}")
                        return "Error reading README file"
                        
        return "No README found"
    
    def _get_commit_history(self, max_commits: int = 50) -> List[Dict[str, str]]:
        """Get recent commit history with important metadata."""
        commits = []
        try:
            # Use simple commit extraction for shallow clones
            for commit in list(self.repo.iter_commits())[:max_commits]:
                # Initialize basic commit info
                commit_info = {
                    "hash": commit.hexsha,
                    "short_hash": commit.hexsha[:7],
                    "author": f"{commit.author.name} <{commit.author.email}>",
                    "date": datetime.fromtimestamp(commit.committed_date).isoformat(),
                    "message": commit.message.strip(),
                    "stats": {"files_changed": 0, "insertions": 0, "deletions": 0},
                    "file_changes": []
                }
                
                try:
                    # Try to get detailed file changes
                    file_changes = []
                    for parent in commit.parents:
                        try:
                            diff_index = parent.diff(commit)
                            for diff in diff_index:
                                try:
                                    change_type = "modified"
                                    if diff.new_file:
                                        change_type = "added"
                                    elif diff.deleted_file:
                                        change_type = "deleted"
                                    elif diff.renamed:
                                        change_type = "renamed"
                                    
                                    # Determine the path to show
                                    path = None
                                    if hasattr(diff, 'b_path') and diff.b_path:
                                        path = diff.b_path
                                    elif hasattr(diff, 'a_path') and diff.a_path:
                                        path = diff.a_path
                                    else:
                                        # Skip files with no path information
                                        continue
                                    
                                    # Add basic file change info without stats
                                    file_changes.append({
                                        "path": path,
                                        "change_type": change_type,
                                        "insertions": 0,
                                        "deletions": 0
                                    })
                                except Exception as e:
                                    logger.warning(f"Error processing diff in commit {commit.hexsha}: {e}")
                                    continue
                        except Exception as e:
                            logger.warning(f"Error getting diff for commit {commit.hexsha}: {e}")
                            continue
                    
                    # Update commit stats
                    stats = {"files_changed": len(file_changes), "insertions": 0, "deletions": 0}
                    commit_info["stats"] = stats
                    commit_info["file_changes"] = file_changes
                except Exception as e:
                    logger.warning(f"Error getting detailed info for commit {commit.hexsha}: {e}")
                    # Keep the basic commit info without detailed changes
                
                commits.append(commit_info)
                self.commit_history.append(commit_info)
                
        except Exception as e:
            logger.error(f"Error retrieving commit history: {e}")
            # Return empty list if we can't get commits
            return []
        
        return commits
    
    def _get_file_structure(self) -> Dict[str, Any]:
        """Create a map of the repository file structure."""
        file_structure = {}
        repo_dir = self.repo.working_dir
        
        # Binary file extensions to skip
        binary_extensions = {
            '.jpg', '.jpeg', '.png', '.gif', '.ico', '.bmp', '.tiff', '.webp',  # Images
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',  # Documents
            '.zip', '.tar', '.gz', '.rar', '.7z',  # Archives
            '.exe', '.dll', '.so', '.dylib', '.bin',  # Binaries
            '.mp3', '.mp4', '.wav', '.avi', '.mov', '.flv',  # Media
            '.pyc', '.pyo', '.pyd',  # Python compiled
            '.jar', '.class',  # Java compiled
            '.o', '.a', '.lib',  # C/C++ compiled
        }
        
        for root, dirs, files in os.walk(repo_dir):
            # Skip .git and other hidden directories
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            
            # Make path relative to the repo root
            rel_path = os.path.relpath(root, repo_dir)
            
            # Skip current directory for cleaner structure
            if rel_path == '.':
                # Add files directly to root level
                for file in files:
                    if not file.startswith('.'):
                        file_path = file  # Just the filename for root level files
                        full_path = os.path.join(root, file)
                        
                        # Skip binary files based on extension
                        _, ext = os.path.splitext(file)
                        if ext.lower() in binary_extensions:
                            self.file_contents[file_path] = "[Binary content]"
                            file_structure[file] = None
                            continue
                        
                        if os.path.isfile(full_path):
                            try:
                                with open(full_path, 'r', encoding='utf-8') as f:
                                    content = f.read()
                                    self.file_contents[file_path] = content
                                    # Generate embedding for file content
                                    self.file_embeddings[file_path] = self.model.encode(content[:5000])  # Limit content size
                            except (UnicodeDecodeError, IsADirectoryError, PermissionError, OSError):
                                # Skip binary files or those we can't read
                                self.file_contents[file_path] = "[Binary content]"
                            
                            # Store file name in root structure
                            file_structure[file] = None
                continue
            
            # Navigate to the correct position in the structure
            path_parts = rel_path.split(os.sep)
            current_level = file_structure
            for part in path_parts:
                if part not in current_level:
                    current_level[part] = {}
                current_level = current_level[part]
            
            # Add files at this level
            for file in files:
                if not file.startswith('.'):
                    file_path = os.path.join(rel_path, file)  # Path relative to repo root
                    full_path = os.path.join(root, file)
                    
                    # Skip binary files based on extension
                    _, ext = os.path.splitext(file)
                    if ext.lower() in binary_extensions:
                        self.file_contents[file_path] = "[Binary content]"
                        current_level[file] = None
                        continue
                    
                    if os.path.isfile(full_path):
                        try:
                            with open(full_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                                self.file_contents[file_path] = content
                                # Generate embedding for file content
                                self.file_embeddings[file_path] = self.model.encode(content[:5000])  # Limit content size
                        except (UnicodeDecodeError, IsADirectoryError, PermissionError, OSError):
                            # Skip binary files or those we can't read
                            self.file_contents[file_path] = "[Binary content]"
                        
                        # Store file name in structure
                        current_level[file] = None
        
        return file_structure
    
    def _identify_important_files(self) -> List[str]:
        """Identify important files in the repository."""
        important_patterns = [
            r'.*\.md$',  # Markdown docs
            r'.*\.py$',  # Python files
            r'.*\.java$',  # Java files
            r'.*\.js$',  # JavaScript files
            r'.*\.ts$',  # TypeScript files
            r'.*\.go$',  # Go files
            r'.*\.rs$',  # Rust files
            r'.*\.c$',  # C files
            r'.*\.cpp$',  # C++ files
            r'.*\.h$',  # Header files
            r'package\.json$',  # Node.js package
            r'requirements\.txt$',  # Python requirements
            r'Dockerfile$',  # Docker config
            r'docker-compose\.yml$',  # Docker Compose
            r'\.github/workflows/.*\.yml$',  # GitHub Actions
        ]
        
        important_files = []
        for file_path in self.file_contents.keys():
            for pattern in important_patterns:
                if re.match(pattern, file_path):
                    important_files.append(file_path)
                    break
        
        return important_files
    
    def search_relevant_files(self, query: str, top_k: int = 5) -> List[Tuple[str, str]]:
        """Search for files relevant to a query using embeddings."""
        if not self.file_embeddings:
            logger.warning("No file embeddings available for search")
            return []
        
        query_embedding = self.model.encode(query)
        
        # Calculate similarities
        similarities = {}
        for file_path, embedding in self.file_embeddings.items():
            similarity = np.dot(query_embedding, embedding) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(embedding)
            )
            similarities[file_path] = similarity
        
        # Sort by similarity
        sorted_files = sorted(similarities.items(), key=lambda x: x[1], reverse=True)
        
        # Return top_k files with their content
        return [(file_path, self.file_contents[file_path]) 
                for file_path, _ in sorted_files[:top_k]]
    
    def search_commit_history(self, query: str) -> List[Dict[str, str]]:
        """Search commit history for relevant commits."""
        if not self.commit_history:
            logger.warning("No commit history available for search")
            return []
        
        # Convert query to embedding
        query_embedding = self.model.encode(query)
        
        # Generate embeddings for commit messages
        commit_embeddings = {}
        for commit in self.commit_history:
            commit_embeddings[commit["hash"]] = self.model.encode(commit["message"])
        
        # Calculate similarities
        similarities = {}
        for commit_hash, embedding in commit_embeddings.items():
            similarity = np.dot(query_embedding, embedding) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(embedding)
            )
            similarities[commit_hash] = similarity
        
        # Sort by similarity and return top 5
        sorted_commits = sorted(similarities.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Return commit information
        return [commit for commit in self.commit_history 
                if commit["hash"] in [hash for hash, _ in sorted_commits]]


class GeminiClient:
    """Client for interacting with Gemini API."""
    
    def __init__(self, repo_analyzer, model_name="models/gemini-1.5-pro"):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("Gemini API key not set in environment variables")
        
        genai.configure(api_key=self.api_key)
        self.model_name = model_name
        self.repo_analyzer = repo_analyzer
        
        logger.info(f"Initialized Gemini client with model: {model_name}")
    
    async def chat(self, messages: List[Dict[str, str]]):
        """Process chat messages with repository context."""
        if not messages or len(messages) == 0:
            raise ValueError("No messages provided")
            
        # Check if we received Pydantic model objects and convert them to dictionaries
        if hasattr(messages[-1], 'role'):  # This is a Pydantic model
            dict_messages = [message.dict() for message in messages]
        else:
            dict_messages = messages
            
        # Check if last message is from user
        if dict_messages[-1]["role"] != "user":
            raise ValueError("Last message must be from user")
        
        user_query = dict_messages[-1]["content"]
        
        # Find relevant files for the query - increase number for more context
        relevant_files = self.repo_analyzer.search_relevant_files(user_query, top_k=10)
        
        # Find relevant commits for the query with detailed file changes
        relevant_commits = self.repo_analyzer.search_commit_history(user_query)
        
        # Add detailed information about relevant commits
        detailed_commits = []
        for commit in relevant_commits:
            # Get file diffs for this commit
            file_changes = commit.get("file_changes", [])
            for file_change in file_changes:
                # Try to get the content diff if not already present
                if "diff" not in file_change and file_change["change_type"] != "deleted":
                    file_change["diff"] = self._get_file_diff(commit["hash"], file_change["path"])
            
            detailed_commits.append({
                "hash": commit["hash"],
                "short_hash": commit["short_hash"],
                "author": commit["author"],
                "date": commit["date"],
                "message": commit["message"],
                "stats": commit["stats"],
                "file_changes": file_changes
            })
        
        # Add important files if there aren't enough relevant files
        important_files = []
        if len(relevant_files) < 5 and hasattr(self.repo_analyzer, "important_files"):
            for file_path in self.repo_analyzer.important_files[:5]:
                if file_path in self.repo_analyzer.file_contents and not any(path == file_path for path, _ in relevant_files):
                    important_files.append((file_path, self.repo_analyzer.file_contents[file_path]))
        
        # Prepare basic repo overview
        repo_info = {
            "name": os.path.basename(self.repo_analyzer.repo.working_dir),
            "description": self._get_readme_summary(),
        }
        
        # Prepare context for Gemini
        context = {
            "repo_info": repo_info,
            "relevant_files": [
                {"path": path, "content": content[:2000] + "..." if len(content) > 2000 else content}
                for path, content in relevant_files
            ],
            "important_files": [
                {"path": path, "content": content[:1000] + "..." if len(content) > 1000 else content}
                for path, content in important_files
            ],
            "relevant_commits": detailed_commits,
            "conversation_history": [
                {"role": msg["role"], "content": msg["content"]} 
                for msg in dict_messages[:-1]  # Exclude the latest user message which we're processing
            ]
        }
        
        context_str = json.dumps(context, indent=2)
        
        # Generate response
        logger.info(f"Generating response using {self.model_name}")
        response = self._generate_response(user_query, context_str)
        
        return {
            "message": {"role": "assistant", "content": response},
            "relevant_files": [path for path, _ in relevant_files],
            "relevant_commits": detailed_commits
        }
    
    def _get_file_diff(self, commit_hash, file_path):
        """Get the diff of a file at a specific commit."""
        try:
            repo = self.repo_analyzer.repo
            commit = repo.commit(commit_hash)
            
            if not commit.parents:
                # Initial commit, no parent to diff against
                return "Initial commit, file added"
                
            parent = commit.parents[0]
            
            # Get the diff between this commit and its parent
            try:
                diff_str = ""
                diffs = parent.diff(commit, paths=[file_path])
                
                for diff_item in diffs:
                    # Get the actual diff content
                    try:
                        diff_str = diff_item.diff.decode('utf-8', errors='replace')
                    except:
                        diff_str = "Binary file or encoding error"
                
                return diff_str if diff_str else "No changes detected"
            except:
                return "Could not retrieve diff"
        except Exception as e:
            logger.error(f"Error getting file diff: {e}")
            return "Error retrieving diff"
    
    def _get_readme_summary(self):
        """Get a summary of the README file."""
        try:
            readme_paths = ['README.md', 'README.rst', 'Readme.md', 'readme.md']
            for path in readme_paths:
                full_path = os.path.join(self.repo_analyzer.repo.working_dir, path)
                if os.path.exists(full_path):
                    with open(full_path, 'r', encoding='utf-8') as f:
                        return f.read()[:500] + "..."
            return "No README found"
        except:
            return "Error reading README"
    
    def _generate_response(self, query, context_str):
        """Generate a response from Gemini."""
        try:
            genai_model = genai.GenerativeModel(self.model_name)
            
            prompt = f"""
            You are RepoSage, an AI assistant specialized in analyzing and explaining GitHub repositories.
            You should help the user understand repository structure, code, commits, and functionality.
            
            Use the following repository context to answer the user's question. Your goal is to provide
            clear, accurate and helpful information about the repository.
            
            REPOSITORY CONTEXT:
            {context_str}
            
            USER QUESTION:
            {query}
            
            Provide a clear and helpful response. If you refer to specific code or files, use markdown formatting
            to make it easy to read. If you're not sure about something, be honest about your limitations.
            """
            
            response = genai_model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return f"I'm sorry, I encountered an error while processing your request: {str(e)}"

    def get_full_commit_history(self):
        """Get complete commit history from start of repository."""
        try:
            repo = self.repo_analyzer.repo
            commits = []
            
            # Get all commits with no limit
            for commit in repo.iter_commits():
                # Basic commit info
                commit_info = {
                    "hash": commit.hexsha,
                    "short_hash": commit.hexsha[:7],
                    "author": f"{commit.author.name} <{commit.author.email}>",
                    "date": datetime.fromtimestamp(commit.committed_date).isoformat(),
                    "message": commit.message.strip(),
                    "stats": {"files_changed": 0, "insertions": 0, "deletions": 0},
                    "file_changes": []
                }
                
                # Get file changes for this commit
                file_changes = []
                for parent in commit.parents:
                    try:
                        diff_index = parent.diff(commit)
                        for diff in diff_index:
                            try:
                                change_type = "modified"
                                if diff.new_file:
                                    change_type = "added"
                                elif diff.deleted_file:
                                    change_type = "deleted"
                                elif diff.renamed:
                                    change_type = "renamed"
                                
                                path = None
                                if hasattr(diff, 'b_path') and diff.b_path:
                                    path = diff.b_path
                                elif hasattr(diff, 'a_path') and diff.a_path:
                                    path = diff.a_path
                                else:
                                    continue
                                
                                # Get diff content
                                diff_content = ""
                                try:
                                    diff_content = diff.diff.decode('utf-8', errors='replace')
                                except:
                                    diff_content = "Binary file or encoding error"
                                
                                file_changes.append({
                                    "path": path,
                                    "change_type": change_type,
                                    "diff": diff_content
                                })
                            except Exception as e:
                                logger.warning(f"Error processing diff in commit {commit.hexsha}: {e}")
                    except Exception as e:
                        logger.warning(f"Error getting diff for commit {commit.hexsha}: {e}")
                
                # Set files changed count
                commit_info["stats"]["files_changed"] = len(file_changes)
                commit_info["file_changes"] = file_changes
                
                commits.append(commit_info)
            
            return commits
        except Exception as e:
            logger.error(f"Error getting full commit history: {e}")
            return []


class GitHubClient:
    """Client for interacting with GitHub API."""
    
    def __init__(self, token: str, repository: str):
        self.github = Github(token)
        self.repo = self.github.get_repo(repository)
    
    def get_issue_details(self, issue_number: int) -> Dict[str, Any]:
        """Get details of a specific issue."""
        issue = self.repo.get_issue(issue_number)
        return {
            "title": issue.title,
            "body": issue.body,
            "author": issue.user.login,
            "number": issue.number,
            "created_at": issue.created_at.isoformat(),
        }
    
    def get_comment_details(self, comment_id: int) -> Dict[str, Any]:
        """Get details of a specific issue comment."""
        comment = self.repo.get_comment(comment_id)
        return {
            "body": comment.body,
            "author": comment.user.login,
            "created_at": comment.created_at.isoformat(),
        }
    
    def reply_to_issue(self, issue_number: int, message: str) -> None:
        """Post a reply to an issue."""
        issue = self.repo.get_issue(issue_number)
        issue.create_comment(message)
        logger.info(f"Posted reply to issue #{issue_number}")


def main():
    """Main execution function."""
    # Get environment variables
    gemini_api_key = os.environ.get('GEMINI_API_KEY')
    github_token = os.environ.get('GITHUB_TOKEN')
    repository = os.environ.get('REPOSITORY')
    issue_number = os.environ.get('ISSUE_NUMBER')
    comment_id = os.environ.get('COMMENT_ID')
    event_name = os.environ.get('EVENT_NAME')
    repo_path = os.environ.get('REPO_PATH', '.')  # Get repo path or default to current dir
    
    if not all([gemini_api_key, github_token, repository, issue_number]):
        logger.error("Missing required environment variables")
        sys.exit(1)
    
    try:
        issue_number = int(issue_number)
    except ValueError:
        logger.error(f"Invalid issue number: {issue_number}")
        sys.exit(1)
    
    # Initialize clients
    github_client = GitHubClient(github_token, repository)
    repo_analyzer = RepoAnalyzer(repo_path)
    
    # Get query text based on event type
    if event_name == 'issues':
        issue_details = github_client.get_issue_details(issue_number)
        query = issue_details['body']
    elif event_name == 'issue_comment' and comment_id:
        try:
            comment_id = int(comment_id)
            comment_details = github_client.get_comment_details(comment_id)
            query = comment_details['body']
        except (ValueError, KeyError) as e:
            logger.error(f"Error processing comment: {e}")
            sys.exit(1)
    else:
        logger.error(f"Unsupported event type: {event_name}")
        sys.exit(1)
    
    # Analyze repository
    repo_analysis = repo_analyzer.analyze_repo()
    
    # Find relevant files for the query
    relevant_files = repo_analyzer.search_relevant_files(query)
    relevant_commits = repo_analyzer.search_commit_history(query)
    
    # Prepare context for Gemini
    context = {
        "repo_info": repo_analysis["repo_info"],
        "relevant_files": [
            {"path": path, "content": content[:1000] + "..." if len(content) > 1000 else content}
            for path, content in relevant_files
        ],
        "relevant_commits": relevant_commits,
    }
    
    context_str = json.dumps(context, indent=2)
    
    # Generate response
    gemini_client = GeminiClient(repo_analyzer)
    response = gemini_client.chat([{"role": "user", "content": query}])
    
    # Add disclaimer
    full_response = f"""
## RepoSage Response

{response["message"]["content"]}

---
*I'm a GitHub bot powered by Gemini 2.0 Flash. I analyze repository content, commit history, and file changes to answer your questions.*
"""
    
    # Reply to the issue
    github_client.reply_to_issue(issue_number, full_response)
    logger.info("Successfully processed query and posted response")


if __name__ == "__main__":
    main() 