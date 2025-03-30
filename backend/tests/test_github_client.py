"""
Tests for the GitHubClient class
"""
import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from chatbot import GitHubClient

class TestGitHubClient(unittest.TestCase):
    """Test cases for the GitHubClient class."""
    
    @patch('chatbot.Github')
    def setUp(self, mock_github):
        """Set up test fixtures."""
        self.mock_github = mock_github
        self.mock_github_instance = mock_github.return_value
        self.mock_repo = MagicMock()
        self.mock_github_instance.get_repo.return_value = self.mock_repo
        
        # Create client with mocked components
        self.client = GitHubClient('fake-token', 'owner/repo')
    
    def test_initialization(self):
        """Test client initialization."""
        # Verify Github was initialized with token
        self.mock_github.assert_called_once_with('fake-token')
        
        # Verify repo was fetched
        self.mock_github_instance.get_repo.assert_called_once_with('owner/repo')
        
        # Verify client attributes
        self.assertEqual(self.client.github, self.mock_github_instance)
        self.assertEqual(self.client.repo, self.mock_repo)
    
    def test_get_issue_details(self):
        """Test fetching issue details."""
        # Set up mock issue
        mock_issue = MagicMock()
        mock_issue.title = "Test Issue"
        mock_issue.body = "This is a test issue"
        mock_issue.user.login = "testuser"
        mock_issue.number = 42
        mock_issue.created_at = datetime(2023, 1, 1, 12, 0, 0)
        self.mock_repo.get_issue.return_value = mock_issue
        
        # Call the method
        result = self.client.get_issue_details(42)
        
        # Verify repo.get_issue was called
        self.mock_repo.get_issue.assert_called_once_with(42)
        
        # Verify the result
        self.assertEqual(result["title"], "Test Issue")
        self.assertEqual(result["body"], "This is a test issue")
        self.assertEqual(result["author"], "testuser")
        self.assertEqual(result["number"], 42)
        self.assertEqual(result["created_at"], "2023-01-01T12:00:00")
    
    def test_get_comment_details(self):
        """Test fetching comment details."""
        # Set up mock comment
        mock_comment = MagicMock()
        mock_comment.body = "This is a test comment"
        mock_comment.user.login = "testuser"
        mock_comment.created_at = datetime(2023, 1, 1, 12, 0, 0)
        self.mock_repo.get_comment.return_value = mock_comment
        
        # Call the method
        result = self.client.get_comment_details(123)
        
        # Verify repo.get_comment was called
        self.mock_repo.get_comment.assert_called_once_with(123)
        
        # Verify the result
        self.assertEqual(result["body"], "This is a test comment")
        self.assertEqual(result["author"], "testuser")
        self.assertEqual(result["created_at"], "2023-01-01T12:00:00")
    
    def test_reply_to_issue(self):
        """Test replying to an issue."""
        # Set up mock issue
        mock_issue = MagicMock()
        self.mock_repo.get_issue.return_value = mock_issue
        
        # Call the method
        self.client.reply_to_issue(42, "Test response")
        
        # Verify repo.get_issue was called
        self.mock_repo.get_issue.assert_called_once_with(42)
        
        # Verify issue.create_comment was called
        mock_issue.create_comment.assert_called_once_with("Test response")


if __name__ == '__main__':
    unittest.main() 