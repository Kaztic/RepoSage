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
from git import Repo, GitCommandError
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
        try:
            repo_info = self._get_repo_info()
        except Exception as e:
            logger.error(f"Error getting repository info: {e}", exc_info=True)
            repo_info = {
                "name": os.path.basename(self.repo.working_dir),
                "description": "Error extracting repository description",
                "branches": [],
                "default_branch": "main"
            }
        
        # Then run heavier operations in parallel
        commit_history = []
        file_structure = {}
        important_files = []
        
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                future_commit_history = executor.submit(self._get_commit_history)
                future_file_structure = executor.submit(self._get_file_structure)
                
                # Wait for all tasks to complete with exception handling
                try:
                    commit_history = future_commit_history.result()
                except Exception as e:
                    logger.error(f"Error getting commit history: {e}", exc_info=True)
                    commit_history = []
                
                try:
                    file_structure = future_file_structure.result()
                except Exception as e:
                    logger.error(f"Error getting file structure: {e}", exc_info=True)
                    file_structure = {}
                
            # Only run this after we have file structure
            try:
                important_files = self._identify_important_files()
            except Exception as e:
                logger.error(f"Error identifying important files: {e}", exc_info=True)
                important_files = []
        except Exception as e:
            logger.error(f"Error during parallel analysis: {e}", exc_info=True)
        
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
        # Get the repo name
        repo_name = os.path.basename(self.repo.working_dir)
        
        # Try to determine the primary language if possible
        language = "Unknown"
        try:
            # Look for common language indicators
            if os.path.exists(os.path.join(self.repo.working_dir, "package.json")):
                language = "JavaScript/TypeScript"
            elif os.path.exists(os.path.join(self.repo.working_dir, "go.mod")):
                language = "Go"
            elif os.path.exists(os.path.join(self.repo.working_dir, "pom.xml")):
                language = "Java"
            elif os.path.exists(os.path.join(self.repo.working_dir, "requirements.txt")) or \
                 os.path.exists(os.path.join(self.repo.working_dir, "setup.py")):
                language = "Python"
            elif os.path.exists(os.path.join(self.repo.working_dir, "Cargo.toml")):
                language = "Rust"
            elif os.path.exists(os.path.join(self.repo.working_dir, "CMakeLists.txt")):
                language = "C/C++"
            elif os.path.exists(os.path.join(self.repo.working_dir, "Gemfile")):
                language = "Ruby"
            
            # If we couldn't determine from common project files, check file counts
            if language == "Unknown":
                file_counts = {}
                for root, _, files in os.walk(self.repo.working_dir):
                    for file in files:
                        ext = os.path.splitext(file)[1].lower()
                        if ext:
                            file_counts[ext] = file_counts.get(ext, 0) + 1
                
                # Map extensions to languages
                ext_to_lang = {
                    ".py": "Python",
                    ".js": "JavaScript",
                    ".ts": "TypeScript",
                    ".tsx": "TypeScript/React",
                    ".jsx": "JavaScript/React",
                    ".java": "Java",
                    ".go": "Go",
                    ".rs": "Rust",
                    ".c": "C",
                    ".cpp": "C++",
                    ".h": "C/C++",
                    ".rb": "Ruby",
                    ".php": "PHP",
                    ".cs": "C#",
                    ".swift": "Swift"
                }
                
                # Find the most common extension
                if file_counts:
                    most_common_ext = max(file_counts.items(), key=lambda x: x[1])[0]
                    language = ext_to_lang.get(most_common_ext, "Unknown")
        except Exception as e:
            logger.warning(f"Error determining primary language: {e}")
            language = "Unknown"
            
        # Extract original full name from remote URL if possible
        full_name = ""
        try:
            origin_url = self.repo.git.config('--get', 'remote.origin.url')
            if 'github.com' in origin_url:
                # Extract owner/repo format from GitHub URL
                if origin_url.endswith('.git'):
                    origin_url = origin_url[:-4]  # Remove .git suffix
                parts = origin_url.split('github.com/')
                if len(parts) > 1:
                    full_name = parts[1]
        except Exception as e:
            logger.warning(f"Error extracting full repo name: {e}")
            
        return {
            "name": repo_name,
            "description": self._get_readme_summary(),
            "branches": [branch.name for branch in self.repo.branches],
            "default_branch": self.repo.active_branch.name,
            "language": language,
            "full_name": full_name
        }
    
    def _get_readme_summary(self) -> str:
        """Extract summary from README if available using Gemini."""
        readme_paths = ['README.md', 'README.rst', 'Readme.md', 'readme.md']
        for path in readme_paths:
            full_path = os.path.join(self.repo.working_dir, path)
            if os.path.exists(full_path):
                with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
                    try:
                        content = f.read()
                        
                        # If README doesn't exist or is empty, return a default message
                        if not content.strip():
                            return "No README content available."
                        
                        # Try to use Gemini to summarize the README
                        try:
                            # Import the Google Generative AI library
                            import google.generativeai as genai
                            from google.api_core.exceptions import GoogleAPIError
                            
                            # Get Gemini API key from environment variables
                            api_key = os.environ.get('GEMINI_API_KEY')
                            
                            if api_key:
                                # Configure the Gemini API
                                genai.configure(api_key=api_key)
                                
                                # Limit content length to prevent token overflow
                                max_content_length = 20000
                                if len(content) > max_content_length:
                                    content = content[:max_content_length] + "..."
                                
                                # Create the model and generate a summary
                                model = genai.GenerativeModel('models/gemini-1.5-flash')
                                prompt = f"Summarize the following README file to describe what this project does, in a simple and clear way for developers:\n\n{content}"
                                
                                response = model.generate_content(prompt)
                                
                                if response.text and response.text.strip():
                                    return response.text.strip()
                                
                                # If Gemini response is empty, fall back to default processing
                                logger.warning("Gemini returned empty summary, falling back to default processing")
                            else:
                                logger.warning("No Gemini API key found, falling back to default processing")
                                
                        except (ImportError, GoogleAPIError, Exception) as e:
                            logger.warning(f"Error using Gemini for README summarization: {e}")
                            # Continue with default processing if Gemini fails
                        
                        # Default processing (fallback if Gemini fails)
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
    
    def get_commit_by_hash(self, commit_hash: str, max_files: int = 200) -> Optional[Dict[str, Any]]:
        """Retrieve a specific commit by hash.
        
        Args:
            commit_hash: The hash of the commit to retrieve
            max_files: Maximum number of files to process to avoid timeouts
        """
        try:
            # Clean and normalize the commit hash first
            original_hash = commit_hash
            commit_hash = commit_hash.strip()
            
            # Remove any non-hexadecimal characters
            cleaned_hash = re.sub(r'[^0-9a-fA-F]', '', commit_hash)
            
            if cleaned_hash != commit_hash:
                logger.info(f"Cleaned commit hash from '{commit_hash}' to '{cleaned_hash}'")
                commit_hash = cleaned_hash
            
            # If the hash is empty after cleaning, return None
            if not commit_hash:
                logger.warning(f"Invalid commit hash after cleaning: '{original_hash}'")
                return None
                
            # First try to find in cached history
            for commit in self.commit_history:
                # Check if the provided hash matches either the full hash or the short hash
                if commit_hash == commit["hash"] or commit["hash"].startswith(commit_hash) or commit["short_hash"] == commit_hash:
                    return commit
            
            # If not found in cache, try to resolve the hash using git rev-parse
            # This helps with very short or ambiguous hashes
            try:
                full_hash = self.repo.git.rev_parse(f"{commit_hash}")
                if full_hash:
                    # If we get here, the hash is valid but wasn't in our cache
                    logger.info(f"Resolved short hash {commit_hash} to full hash {full_hash}")
                    commit_hash = full_hash
            except GitCommandError as e:
                # If rev-parse fails, continue with the original hash
                logger.warning(f"Failed to resolve hash with rev-parse: {e}")
                pass
            
            # Now try to get the commit
            try:
                commit = self.repo.commit(commit_hash)
                
                commit_info = {
                    "hash": commit.hexsha,
                    "short_hash": commit.hexsha[:7],
                    "author": f"{commit.author.name} <{commit.author.email}>",
                    "date": datetime.fromtimestamp(commit.committed_date).isoformat(),
                    "message": commit.message.strip(),
                    "stats": {"files_changed": 0, "insertions": 0, "deletions": 0},
                    "file_changes": []
                }
                
                # Get basic stats first - using git command directly can be faster
                try:
                    # Get summary stats using git show
                    stats_summary = self.repo.git.show(
                        commit.hexsha, 
                        '--stat',
                        '--format=',  # No commit info, just stats
                    )
                    
                    # Extract summary stats from last line if possible
                    if stats_summary:
                        last_line = stats_summary.strip().split('\n')[-1]
                        if 'changed' in last_line and ('insertion' in last_line or 'deletion' in last_line):
                            parts = last_line.split(',')
                            files_changed = 0
                            insertions = 0
                            deletions = 0
                            
                            for part in parts:
                                part = part.strip()
                                if 'file' in part:
                                    try:
                                        files_changed = int(part.split()[0])
                                    except (ValueError, IndexError):
                                        pass
                                elif 'insertion' in part:
                                    try:
                                        insertions = int(part.split()[0])
                                    except (ValueError, IndexError):
                                        pass
                                elif 'deletion' in part:
                                    try:
                                        deletions = int(part.split()[0])
                                    except (ValueError, IndexError):
                                        pass
                            
                            commit_info["stats"] = {
                                "files_changed": files_changed,
                                "insertions": insertions,
                                "deletions": deletions
                            }
                except Exception as e:
                    logger.warning(f"Error getting summary stats: {e}")
                
                # Process file changes with limits
                file_changes = []
                file_count = 0
                total_insertions = 0
                total_deletions = 0
                
                if commit.parents:
                    parent = commit.parents[0]
                    
                    # Use git diff-tree for better performance with large commits
                    try:
                        # Get name-status format which is much faster
                        diff_output = self.repo.git.diff_tree(
                            '-r',  # recursive
                            '--name-status',  # just show names and status, not content
                            parent.hexsha,
                            commit.hexsha
                        )
                        
                        # Process the output
                        for line in diff_output.strip().split('\n'):
                            if not line or '\t' not in line:
                                continue
                                
                            # Stop if we've reached the limit
                            if file_count >= max_files:
                                logger.warning(f"Reached maximum file limit ({max_files}), truncating results")
                                break
                                
                            status, path = line.split('\t', 1)
                            status = status.strip()
                            
                            # Map git status to our change types
                            change_type = "modified"
                            if status == 'A':
                                change_type = "added"
                            elif status == 'D':
                                change_type = "deleted"
                            elif status == 'R':
                                change_type = "renamed"
                            
                            # Add basic file change info
                            file_changes.append({
                                "path": path,
                                "change_type": change_type,
                                "insertions": 0,
                                "deletions": 0
                            })
                            
                            file_count += 1
                            
                    except Exception as e:
                        logger.warning(f"Error processing diff-tree: {e}")
                        
                        # Fallback - use GitPython's diff but with limits
                        try:
                            diff_index = parent.diff(commit)
                            for diff in diff_index:
                                # Stop if we've reached the limit
                                if file_count >= max_files:
                                    logger.warning(f"Reached maximum file limit ({max_files}), truncating results")
                                    break
                                    
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
                                
                                # Add basic file change info
                                file_changes.append({
                                    "path": path,
                                    "change_type": change_type,
                                    "insertions": 0,
                                    "deletions": 0
                                })
                                
                                file_count += 1
                        except Exception as e:
                            logger.warning(f"Error processing diffs: {e}")
                else:
                    # Initial commit handling - limit file count
                    try:
                        # Use git ls-tree which is faster than traversing the tree
                        ls_tree_output = self.repo.git.ls_tree('-r', commit.hexsha)
                        
                        for line in ls_tree_output.strip().split('\n'):
                            if not line:
                                continue
                                
                            # Stop if we've reached the limit
                            if file_count >= max_files:
                                logger.warning(f"Reached maximum file limit ({max_files}), truncating results")
                                break
                                
                            # Format is: mode type hash\tpath
                            if '\t' in line:
                                file_path = line.split('\t', 1)[1]
                                file_changes.append({
                                    "path": file_path,
                                    "change_type": "added",
                                    "insertions": 0,
                                    "deletions": 0
                                })
                                
                                file_count += 1
                    except Exception as e:
                        logger.warning(f"Error listing files in initial commit: {e}")
                
                # Update stats if we had to limit files
                if file_count == max_files and commit_info["stats"]["files_changed"] > max_files:
                    commit_info["stats"]["files_changed"] = max_files
                    commit_info["stats"]["note"] = f"Display limited to {max_files} files"
                
                # Set the file changes
                commit_info["file_changes"] = file_changes
                
                return commit_info
            except ValueError as e:
                if "Check that it exists" in str(e):
                    logger.error(f"Commit {commit_hash} not found in repository. This might be due to shallow clone limits.")
                    return None
            except GitCommandError as e:
                if "bad object" in str(e) or "not in" in str(e):
                    logger.error(f"Git error: Commit {commit_hash} not found. This may be outside the shallow clone depth.")
                    return {
                        "status": "error",
                        "message": f"Commit {commit_hash} not found. This may be because it's older than the repository clone depth (1000 commits). Try using a more recent commit."
                    }
                else:
                    logger.error(f"Git error retrieving commit {commit_hash}: {e}")
                    return None
            except Exception as e:
                logger.error(f"Error retrieving commit {commit_hash}: {e}")
                return None
                
        except Exception as e:
            logger.error(f"Error retrieving commit {commit_hash}: {e}")
            return None
            
    def get_file_diff(self, commit_hash: str, file_path: str) -> str:
        """Get the diff for a specific file in a commit."""
        try:
            commit = self.repo.commit(commit_hash)
            
            # Handle different cases based on commit situation
            if not commit.parents:
                # Initial commit - show file contents as addition
                try:
                    blob = commit.tree / file_path
                    if blob.data_stream.read(1024).find(b'\x00') != -1:
                        return "File was added in this commit (binary content)"
                    
                    blob.data_stream.close()
                    content = blob.data_stream.read().decode('utf-8', errors='replace')
                    return f"Initial commit, file added:\n\n{content}"
                except UnicodeDecodeError:
                    return "Binary file (no text diff available)"
                except Exception as e:
                    return f"Error retrieving diff: {str(e)}"
            else:
                # Normal commit with parent
                parent = commit.parents[0]
                
                # Check if file was added in this commit
                try:
                    parent.tree / file_path
                except Exception:  # Fix: adding explicit exception
                    # File didn't exist in parent, so it was added
                    try:
                        blob = commit.tree / file_path
                        # Try to detect if it's a binary file
                        sample = blob.data_stream.read(8192)
                        blob.data_stream.close()
                        
                        if b'\x00' in sample:
                            return "File was added in this commit (binary content)"
                        
                        # Read file content
                        blob = commit.tree / file_path
                        content = blob.data_stream.read().decode('utf-8', errors='replace')
                        return f"File was added in this commit:\n\n{content}"
                    except UnicodeDecodeError:
                        return "Binary file (no text diff available)"
                    except Exception as e:
                        return f"Error retrieving added file content: {str(e)}"
                
                # Check if file was deleted in this commit
                try:
                    commit.tree / file_path
                except Exception:  # Fix: adding explicit exception
                    # File doesn't exist in current commit, so it was deleted
                    try:
                        blob = parent.tree / file_path
                        # Check if binary
                        sample = blob.data_stream.read(8192)
                        blob.data_stream.close()
                        
                        if b'\x00' in sample:
                            return "File was deleted in this commit (binary content)"
                        
                        # Show previous content
                        blob = parent.tree / file_path
                        content = blob.data_stream.read().decode('utf-8', errors='replace')
                        return f"File was deleted in this commit. Previous content:\n\n{content}"
                    except UnicodeDecodeError:
                        return "Binary file (no text diff available)"
                    except Exception as e:
                        return f"Error retrieving deleted file content: {str(e)}"
                
                # Normal file modification
                try:
                    # Get diff using git command for more reliable output
                    diff_text = self.repo.git.diff(
                        f"{parent.hexsha}..{commit.hexsha}",
                        "--",
                        file_path,
                        ignore_blank_lines=False,
                        ignore_space_at_eol=False
                    )
                    
                    if not diff_text.strip():
                        # Check if file mode/permissions changed
                        mode_diff = self.repo.git.diff(
                            f"{parent.hexsha}..{commit.hexsha}",
                            "--summary",
                            "--",
                            file_path
                        )
                        if mode_diff.strip():
                            return "File metadata changed (permissions or mode)"
                        else:
                            return "No changes detected in this file for this commit"
                    
                    return diff_text
                except Exception as e:
                    logger.error(f"Error getting diff for {file_path} in commit {commit_hash}: {e}")
                    return f"Could not retrieve diff: {str(e)}"
                    
        except Exception as e:
            logger.error(f"Error retrieving diff for file {file_path} in commit {commit_hash}: {e}")
            return f"Error retrieving diff: {str(e)}"
    
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
    
    def __init__(self, repo_analyzer, model_name="models/gemini-2.0-flash"):
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
        
        # Check if query contains a likely commit hash
        commit_hash_match = re.search(r'(?:commit\s+)?([0-9a-f]{7,40})', user_query, re.IGNORECASE)
        specific_commit = None
        
        if commit_hash_match:
            # Extract the hash from the match
            possible_hash = commit_hash_match.group(1)
            logger.info(f"Detected possible commit hash in query: {possible_hash}")
            
            # Try to find the commit
            specific_commit = self.repo_analyzer.get_commit_by_hash(possible_hash)
            if specific_commit:
                logger.info(f"Found commit matching hash: {specific_commit['short_hash']}")
        
        # Detect if the query is looking for specific code elements
        code_search_patterns = [
            r'function\s+(\w+)',
            r'class\s+(\w+)',
            r'method\s+(\w+)',
            r'implementation\s+of\s+(\w+)',
            r'how\s+does\s+(\w+)\s+work',
            r'show\s+me\s+(\w+)',
            r'find\s+(\w+)\s+in',
            r'where\s+is\s+(\w+)\s+defined',
            r'what\s+does\s+(\w+)\s+do'
        ]
        
        possible_code_elements = []
        for pattern in code_search_patterns:
            matches = re.finditer(pattern, user_query, re.IGNORECASE)
            for match in matches:
                element_name = match.group(1)
                if len(element_name) > 2:  # Filter out very short names
                    possible_code_elements.append(element_name)
        
        # Find relevant files for the query - increase number for more context
        relevant_files = self.repo_analyzer.search_relevant_files(user_query, top_k=10)
        
        # Enhanced code search when specific elements are mentioned
        code_details = {}
        if possible_code_elements:
            logger.info(f"Detected code element search for: {possible_code_elements}")
            for file_path, content in relevant_files:
                # Basic code inspection (could be enhanced with AST parsing)
                file_ext = os.path.splitext(file_path)[1].lower()
                
                # For Python files, use proper AST parsing
                if file_ext == '.py':
                    try:
                        import ast
                        tree = ast.parse(content)
                        
                        # Look for functions matching the elements
                        for node in ast.walk(tree):
                            if isinstance(node, ast.FunctionDef) and node.name in possible_code_elements:
                                # Get function source
                                func_lines = content.splitlines()[node.lineno-1:node.end_lineno if hasattr(node, 'end_lineno') else node.lineno+20]
                                indent = len(func_lines[0]) - len(func_lines[0].lstrip())
                                
                                # Clean up indentation
                                while all(not line.strip() or line[:indent].isspace() for line in func_lines):
                                    func_lines = [line[indent:] if line.strip() else line for line in func_lines]
                                    
                                code_details[node.name] = {
                                    "type": "function",
                                    "file": file_path,
                                    "line": node.lineno,
                                    "docstring": ast.get_docstring(node),
                                    "args": [arg.arg for arg in node.args.args],
                                    "source": "\n".join(func_lines)
                                }
                            
                            elif isinstance(node, ast.ClassDef) and node.name in possible_code_elements:
                                # Get class source
                                class_lines = content.splitlines()[node.lineno-1:node.end_lineno if hasattr(node, 'end_lineno') else node.lineno+50]
                                indent = len(class_lines[0]) - len(class_lines[0].lstrip())
                                
                                # Clean up indentation
                                while all(not line.strip() or line[:indent].isspace() for line in class_lines):
                                    class_lines = [line[indent:] if line.strip() else line for line in class_lines]
                                
                                code_details[node.name] = {
                                    "type": "class",
                                    "file": file_path,
                                    "line": node.lineno,
                                    "docstring": ast.get_docstring(node),
                                    "source": "\n".join(class_lines)
                                }
                                
                                # Also look for methods in the class
                                for item in node.body:
                                    if isinstance(item, ast.FunctionDef) and item.name in possible_code_elements:
                                        method_lines = content.splitlines()[item.lineno-1:item.end_lineno if hasattr(item, 'end_lineno') else item.lineno+20]
                                        method_indent = len(method_lines[0]) - len(method_lines[0].lstrip())
                                        
                                        # Clean up method indentation
                                        method_lines = [line[method_indent:] if line.strip() else line for line in method_lines]
                                        
                                        code_details[item.name] = {
                                            "type": "method",
                                            "class": node.name,
                                            "file": file_path,
                                            "line": item.lineno,
                                            "docstring": ast.get_docstring(item),
                                            "args": [arg.arg for arg in item.args.args],
                                            "source": "\n".join(method_lines)
                                        }
                    except Exception as e:
                        logger.error(f"Error parsing Python file {file_path}: {e}")
                    
                # Simple search for other file types
                else:
                    for element in possible_code_elements:
                        lines = content.splitlines()
                        
                        # Look for function declarations
                        for i, line in enumerate(lines):
                            if re.search(fr'\bfunction\s+{re.escape(element)}\b|\b{re.escape(element)}\s*[:=]\s*function\b|\bdef\s+{re.escape(element)}\b', line):
                                # Extract ~20 lines of context
                                context_start = max(0, i-1)
                                context_end = min(len(lines), i+20)
                                
                                code_details[element] = {
                                    "type": "function/method",
                                    "file": file_path,
                                    "line": i+1,
                                    "source": "\n".join(lines[context_start:context_end])
                                }
                                break
                            
                            # Look for class declarations
                            elif re.search(fr'\bclass\s+{re.escape(element)}\b', line):
                                # Extract ~50 lines of context for classes
                                context_start = max(0, i-1)
                                context_end = min(len(lines), i+50)
                                
                                code_details[element] = {
                                    "type": "class",
                                    "file": file_path,
                                    "line": i+1,
                                    "source": "\n".join(lines[context_start:context_end])
                                }
                                break
        
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
            "code_details": code_details,
            "relevant_commits": detailed_commits,
            "conversation_history": [
                {"role": msg["role"], "content": msg["content"]} 
                for msg in dict_messages[:-1]  # Exclude the latest user message which we're processing
            ]
        }
        
        context_str = json.dumps(context, indent=2)
        
        # Generate response
        logger.info(f"Generating response using {self.model_name}")
        response = await self._generate_response(user_query, context_str)
        
        return {
            "message": {"role": "assistant", "content": response},
            "relevant_files": [path for path, _ in relevant_files],
            "relevant_commits": detailed_commits
        }
    
    def _get_file_diff(self, commit_hash, file_path):
        """Get the diff of a file at a specific commit."""
        try:
            return self.repo_analyzer.get_file_diff(commit_hash, file_path)
        except Exception as e:
            logger.error(f"Error getting file diff: {e}")
            return "Error retrieving diff"
    
    def _get_readme_summary(self):
        """Get a summary of the README file."""
        return self.repo_analyzer._get_readme_summary()
    
    async def _generate_response(self, query, context_str):
        """Generate a response from Gemini."""
        try:
            genai_model = genai.GenerativeModel(self.model_name)
            
            # Check if this is a code-specific query
            code_search_keywords = ['function', 'class', 'method', 'implementation', 'code', 'definition']
            is_code_query = any(keyword in query.lower() for keyword in code_search_keywords)
            
            # Check if this is a commit-specific query
            commit_search_keywords = ['commit', 'change', 'revision', 'version', 'diff', 'hash']
            is_commit_query = any(keyword in query.lower() for keyword in commit_search_keywords)
            
            # Check if context includes specific commit info
            context_data = json.loads(context_str)
            has_specific_commit = 'repo_info' in context_data and 'specific_commit' in context_data['repo_info']
            
            # Customize the prompt based on the query type
            system_context = """You are RepoSage, an AI assistant specialized in analyzing and explaining GitHub repositories.
            You should help the user understand repository structure, code, commits, and functionality."""
            
            # Add specific instructions for commit analysis if needed
            if has_specific_commit or is_commit_query:
                commit_context = """
                IMPORTANT: A specific commit has been identified in the repository context. When discussing this commit:
                1. Explain the purpose of the commit based on its message and changes
                2. Describe what files were modified and how they were changed
                3. Explain the impact of these changes on the codebase
                4. If available, reference the diff to point out specific code changes
                
                This commit information is crucial context for answering the user's question accurately.
                """
                system_context += commit_context
            
            prompt = f"""
            {system_context}
            
            Use the following repository context to answer the user's question. Your goal is to provide
            clear, accurate and helpful information about the repository.
            
            REPOSITORY CONTEXT:
            {context_str}
            
            USER QUESTION:
            {query}
            
            {"IMPORTANT: When explaining code, always include the FULL implementation details and code snippets from the repository. If asked about a specific function or class, show its complete implementation with any relevant context." if is_code_query else ""}
            
            Provide a clear and helpful response. If you refer to specific code or files, use markdown formatting
            with the appropriate language for syntax highlighting. If you're not sure about something, be honest about your limitations.
            
            If code_details contains implementations of functions or classes the user is asking about, 
            be sure to include these in your response with proper formatting. Never truncate code samples.
            """
            
            # Create generator for streaming response
            response_stream = genai_model.generate_content(prompt, stream=True)
            
            # Collect the response chunks
            response_text = ""
            for chunk in response_stream:
                if hasattr(chunk, 'text'):
                    response_text += chunk.text
                elif hasattr(chunk, 'delta') and hasattr(chunk.delta, 'text'):
                    response_text += chunk.delta.text
            
            return response_text
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


class ClaudeClient:
    """Client for interacting with Claude Sonnet 3.7 API based on repository analysis."""
    
    def __init__(self, repo_analyzer, model_name="claude-3-sonnet-20240229"):
        """Initialize the Claude client with repository analyzer."""
        self.repo_analyzer = repo_analyzer
        self.model_name = model_name
        
        # API key from environment
        anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        if not anthropic_api_key:
            logger.error("ANTHROPIC_API_KEY not found in environment variables")
            raise ValueError("ANTHROPIC_API_KEY not found in environment variables")
        
        # Initialize Claude client
        import anthropic
        self.client = anthropic.Anthropic(api_key=anthropic_api_key)
        
        # Load system prompts and instructions
        self._load_system_prompt()
    
    def _load_system_prompt(self):
        """Load system prompt for Claude from config file or use default."""
        try:
            with open(os.path.join(os.path.dirname(__file__), "config.yaml"), "r") as f:
                config = yaml.safe_load(f)
                self.system_prompt = config.get("claude_system_prompt", self._default_system_prompt())
        except Exception as e:
            logger.warning(f"Error loading system prompt from config: {e}")
            self.system_prompt = self._default_system_prompt()
    
    def _default_system_prompt(self):
        """Default system prompt for Claude."""
        return """You are RepoSage, an advanced AI assistant for analyzing GitHub repositories.
Your goal is to provide accurate, insightful information about repository structure, code patterns, and development history.
You have access to the following information:
1. Repository structure and file contents
2. Commit history and code changes
3. README and documentation

When analyzing code:
- Identify design patterns, architecture, and code organization
- Explain complex code sections with clear, accurate explanations
- Detect potential code smells, bugs, or optimization opportunities
- Provide best practices and improvement suggestions

Keep responses concise, factual, and directly relevant to the query.
Cite specific files, functions, or code snippets when applicable.
If you're uncertain about something, acknowledge your limitations rather than guessing."""
    
    async def chat(self, messages):
        """Process chat messages and generate repository-aware responses."""
        # Convert message format to Claude format
        claude_messages = []
        
        # Add relevant context from repository
        query = None
        for message in messages:
            if message["role"] == "user":
                query = message["content"]
                
        if query:
            # Prepare repository context based on the user query
            context = self._prepare_context(query)
            
            # Add system message with context
            system_message = self.system_prompt + "\n\nRepository Context:\n" + context
        else:
            system_message = self.system_prompt
            
        # Convert messages to Claude message format
        user_message_content = ""
        for message in messages:
            if message["role"] == "user":
                user_message_content += message["content"] + "\n"
        
        try:
            # Generate response from Claude
            response = await self._generate_claude_response(system_message, user_message_content)
            return response
        except Exception as e:
            logger.error(f"Error generating Claude response: {e}")
            return "I encountered an error analyzing this repository. Please try again."
    
    def _prepare_context(self, query):
        """Prepare repository context based on the user query."""
        try:
            # Check if query contains a likely commit hash
            # Look for patterns like "commit abc123" or just "abc123" if it looks like a hash
            commit_hash_match = re.search(r'(?:commit\s+)?([0-9a-f]{7,40})', query, re.IGNORECASE)
            specific_commit = None
            
            if commit_hash_match:
                # Extract the hash from the match
                possible_hash = commit_hash_match.group(1)
                logger.info(f"Detected possible commit hash in query: {possible_hash}")
                
                # Try to find the commit
                specific_commit = self.repo_analyzer.get_commit_by_hash(possible_hash)
                if specific_commit:
                    logger.info(f"Found commit matching hash: {specific_commit['short_hash']}")
            
            # Find relevant files based on the query
            relevant_files = self.repo_analyzer.search_relevant_files(query, top_k=5)
            
            # Search commit history for relevant commits 
            # If we already have a specific commit, make sure it's included
            relevant_commits = self.repo_analyzer.search_commit_history(query)[:3]
            if specific_commit:
                # Add the specific commit at the beginning if not already in the list
                if not any(c['hash'] == specific_commit['hash'] for c in relevant_commits):
                    relevant_commits.insert(0, specific_commit)
            
            # Get README summary for general context
            readme_summary = self._get_readme_summary()
            
            # Compile context information with repository insights
            context_parts = [
                f"Repository Name: {os.path.basename(self.repo_analyzer.repo.working_dir)}",
                f"README Summary: {readme_summary[:500]}...",
            ]
            
            # Add specific commit details if available
            if specific_commit:
                commit_details = [
                    "\nSPECIFIC COMMIT REQUESTED:",
                    f"Hash: {specific_commit['hash']}",
                    f"Short Hash: {specific_commit['short_hash']}",
                    f"Author: {specific_commit['author']}",
                    f"Date: {specific_commit['date']}",
                    f"Message: {specific_commit['message']}",
                ]
                
                # Add file changes for the specific commit
                if specific_commit.get('file_changes'):
                    changes = [f"- {c['path']} ({c['change_type']})" for c in specific_commit['file_changes'][:10]]
                    commit_details.append("Files changed:")
                    commit_details.extend(changes)
                    
                    # Try to add some actual diff content for context if available
                    if len(specific_commit['file_changes']) > 0:
                        try:
                            # Get diff for the first changed file
                            sample_file = specific_commit['file_changes'][0]['path']
                            diff = self.repo_analyzer.get_file_diff(specific_commit['hash'], sample_file)
                            if diff:
                                commit_details.append(f"\nSample diff for {sample_file}:")
                                commit_details.append(f"```diff\n{diff[:1000]}\n```")
                        except Exception as e:
                            logger.warning(f"Could not get diff for sample file: {e}")
                
                context_parts.append("\n".join(commit_details))
            
            # Add relevant files context
            context_parts.append("\nRelevant Files:")
            
            # Add file contents for context
            for file_path, _ in relevant_files:
                content = self.repo_analyzer.file_contents.get(file_path, "")
                if len(content) > 5000:  # Truncate very large files
                    content = content[:5000] + "...[truncated]"
                context_parts.append(f"\nFile: {file_path}\n```\n{content}\n```")
            
            # Add relevant commits if we didn't already add a specific commit
            if relevant_commits and not specific_commit:
                context_parts.append("\nRelevant Commits:")
                for commit in relevant_commits:
                    context_parts.append(f"\nCommit: {commit['short_hash']} - {commit['message']}")
                    if commit.get('file_changes'):
                        file_changes = [f"- {c['path']} ({c['change_type']})" for c in commit['file_changes'][:5]]
                        context_parts.append("\n".join(file_changes))
            
            return "\n".join(context_parts)
        except Exception as e:
            logger.error(f"Error preparing context: {e}", exc_info=True)
            return "Error preparing repository context."
    
    def _get_readme_summary(self):
        """Get README summary from repository."""
        return self.repo_analyzer._get_readme_summary()
    
    async def _generate_claude_response(self, system_message, user_message):
        """Generate response from Claude API."""
        import anthropic
        import json
        
        try:
            # Stream the response from Claude
            async def stream_response():
                response_stream = await self.client.messages.create(
                    model=self.model_name,
                    max_tokens=4000,
                    system=system_message,
                    messages=[
                        {"role": "user", "content": user_message}
                    ],
                    stream=True
                )
                
                # Collect the response chunks
                collected_content = []
                async for chunk in response_stream:
                    if chunk.type == "content_block_delta" and chunk.delta.text:
                        collected_content.append(chunk.delta.text)
                        yield chunk.delta.text
            
            # Instead of awaiting the generator, collect all content first
            response_text = ""
            async for chunk in stream_response():
                response_text += chunk
            
            return response_text
        except Exception as e:
            logger.error(f"Error in Claude API call: {e}")
            return f"Error generating response: {str(e)}"
    
    def analyze_code_complexity(self, file_path):
        """Analyze code complexity for a specific file."""
        import radon.complexity as cc
        import radon.metrics as metrics
        
        content = self.repo_analyzer.file_contents.get(file_path)
        if not content:
            return {"error": "File not found"}
            
        try:
            # Only analyze certain file types
            if file_path.endswith(('.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cpp', '.cs')):
                results = {
                    "file_path": file_path,
                    "metrics": {}
                }
                
                # Calculate complexity metrics
                try:
                    complexity = cc.cc_visit(content)
                    avg_complexity = sum(func.complexity for func in complexity) / len(complexity) if complexity else 0
                    results["metrics"]["cyclomatic_complexity"] = avg_complexity
                    
                    # Add function-level complexity
                    results["functions"] = []
                    for func in complexity:
                        results["functions"].append({
                            "name": func.name,
                            "complexity": func.complexity,
                            "line_number": func.lineno
                        })
                except:
                    pass
                
                # Add raw metrics (lines of code, etc.)
                try:
                    raw_metrics = metrics.mi_visit(content, multi=True)
                    results["metrics"]["maintainability_index"] = raw_metrics.mi
                    results["metrics"]["lines_of_code"] = raw_metrics.sloc
                    results["metrics"]["comment_ratio"] = raw_metrics.comments / raw_metrics.sloc if raw_metrics.sloc > 0 else 0
                except:
                    pass
                
                return results
            else:
                return {"error": "Unsupported file type for complexity analysis"}
                
        except Exception as e:
            logger.error(f"Error analyzing code complexity: {e}")
            return {"error": f"Analysis failed: {str(e)}"}
    
    def generate_code_recommendations(self, file_path):
        """Generate code recommendations for a specific file."""
        content = self.repo_analyzer.file_contents.get(file_path)
        if not content:
            return {"error": "File not found"}
            
        try:
            # Create a message for code review
            prompt = f"""Please review this code and provide specific recommendations for improvement. 
Focus on:
1. Code quality and maintainability
2. Potential bugs or edge cases
3. Performance optimizations
4. Security concerns (if applicable)
5. Best practices for this language

Here's the code:
```
{content}
```

Provide your recommendations in a structured, concise format.
"""
            
            # Send to Claude for analysis
            response = self.client.messages.create(
                model=self.model_name,
                max_tokens=2000,
                system="You are an expert code reviewer. Provide specific, actionable recommendations. Be concise and focus on the most important issues.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extract the response
            return response.content[0].text
                
        except Exception as e:
            logger.error(f"Error generating code recommendations: {e}")
            return {"error": f"Analysis failed: {str(e)}"}


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