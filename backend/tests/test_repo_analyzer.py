"""
Tests for the RepoAnalyzer class
"""
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from chatbot import RepoAnalyzer

class TestRepoAnalyzer(unittest.TestCase):
    """Test cases for the RepoAnalyzer class."""
    
    @patch('chatbot.Repo')
    @patch('chatbot.SentenceTransformer')
    def setUp(self, mock_transformer, mock_repo):
        """Set up test fixtures."""
        self.mock_repo = mock_repo.return_value
        self.mock_transformer = mock_transformer.return_value
        
        # Mock repo attributes
        self.mock_branch = MagicMock()
        self.mock_branch.name = 'main'
        self.mock_repo.branches = [self.mock_branch]
        self.mock_repo.active_branch.name = 'main'
        
        # Create analyzer with mocked components
        self.analyzer = RepoAnalyzer('.')
    
    @patch('os.path.exists')
    @patch('builtins.open')
    def test_get_readme_summary(self, mock_open, mock_exists):
        """Test extracting README summary."""
        # Mock file operations
        mock_exists.return_value = True
        mock_file = MagicMock()
        mock_file.__enter__.return_value.read.return_value = "# Project Title\n\nThis is a test project.\n\nMore details here."
        mock_open.return_value = mock_file
        
        # Call the method
        result = self.analyzer._get_readme_summary()
        
        # Verify the result
        self.assertEqual(result, "# Project Title\n\nThis is a test project.")
        mock_exists.assert_called()
        mock_open.assert_called()
    
    @patch('chatbot.RepoAnalyzer._get_repo_info')
    @patch('chatbot.RepoAnalyzer._get_commit_history')
    @patch('chatbot.RepoAnalyzer._get_file_structure')
    @patch('chatbot.RepoAnalyzer._identify_important_files')
    def test_analyze_repo(self, mock_identify, mock_structure, mock_history, mock_info):
        """Test repository analysis workflow."""
        # Set up mock return values
        mock_info.return_value = {"name": "test-repo"}
        mock_history.return_value = [{"hash": "abc123", "message": "Initial commit"}]
        mock_structure.return_value = {"src": {"main.py": None}}
        mock_identify.return_value = ["src/main.py"]
        
        # Call the method
        result = self.analyzer.analyze_repo()
        
        # Verify the result structure
        self.assertIn("repo_info", result)
        self.assertIn("commit_history", result)
        self.assertIn("file_structure", result)
        self.assertIn("important_files", result)
        
        # Verify all component methods were called
        mock_info.assert_called_once()
        mock_history.assert_called_once()
        mock_structure.assert_called_once()
        mock_identify.assert_called_once()
    
    def test_search_relevant_files(self):
        """Test searching for relevant files using embeddings."""
        # Mock data
        self.analyzer.file_embeddings = {
            "file1.py": [0.1, 0.2, 0.3],
            "file2.py": [0.4, 0.5, 0.6]
        }
        self.analyzer.file_contents = {
            "file1.py": "def hello(): pass",
            "file2.py": "def world(): pass"
        }
        
        # Mock the encoder function
        self.analyzer.model.encode.return_value = [0.4, 0.5, 0.6]
        
        # Call the method with a test query
        with patch('numpy.dot', return_value=0.9), \
             patch('numpy.linalg.norm', return_value=1.0):
            results = self.analyzer.search_relevant_files("test query")
        
        # Verify results
        self.assertEqual(len(results), 2)  # Should return both files
        self.assertIn("file1.py", [r[0] for r in results])
        self.assertIn("file2.py", [r[0] for r in results])


if __name__ == '__main__':
    unittest.main() 