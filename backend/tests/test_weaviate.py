#!/usr/bin/env python3
"""
Test script for Weaviate integration in RepoSage
"""

import os
import sys
import logging
import unittest
from unittest.mock import patch, MagicMock

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from chatbot import get_global_weaviate_client, RepoAnalyzer

# Configure basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('test_weaviate')

class TestWeaviateIntegration(unittest.TestCase):
    """Test cases for Weaviate integration."""

    @patch('weaviate.Client')
    def test_weaviate_client_initialization(self, mock_weaviate):
        """Test that Weaviate client is initialized correctly."""
        # Setup mock
        mock_instance = MagicMock()
        mock_weaviate.return_value = mock_instance
        
        # Mock schema contains_class method
        mock_instance.schema.contains_class.return_value = False
        
        # Call the function
        client = get_global_weaviate_client()
        
        # Assert client was created with expected parameters
        mock_weaviate.assert_called_once()
        
        # Assert schema creation was attempted
        mock_instance.schema.create_class.assert_called_once()
        
    @patch('git.Repo')
    @patch('weaviate.Client')
    def test_repo_analyzer_with_weaviate(self, mock_weaviate, mock_repo):
        """Test RepoAnalyzer with Weaviate integration."""
        # Setup mocks
        mock_weaviate_instance = MagicMock()
        mock_weaviate.return_value = mock_weaviate_instance
        mock_weaviate_instance.schema.contains_class.return_value = True
        
        mock_repo_instance = MagicMock()
        mock_repo.return_value = mock_repo_instance
        mock_repo_instance.working_dir = "/test/repo"
        
        # Initialize batch mock
        mock_batch = MagicMock()
        mock_weaviate_instance.batch.__enter__.return_value = mock_batch
        
        # Mock query for search_relevant_files
        mock_query = MagicMock()
        mock_weaviate_instance.query = mock_query
        mock_query_builder = MagicMock()
        mock_query.get.return_value = mock_query_builder
        mock_query_builder.with_where.return_value = mock_query_builder
        mock_query_builder.with_near_text.return_value = mock_query_builder
        mock_query_builder.with_limit.return_value = mock_query_builder
        
        # Setup mock search results
        mock_result = {
            "data": {
                "Get": {
                    "RepositoryFile": [
                        {"path": "file1.py", "content": "def test(): pass"},
                        {"path": "file2.py", "content": "class Test: pass"}
                    ]
                }
            }
        }
        mock_query_builder.do.return_value = mock_result
        
        # Create analyzer with weaviate
        with patch('chatbot.get_global_weaviate_client', return_value=mock_weaviate_instance):
            analyzer = RepoAnalyzer("/test/repo")
            
            # Assert the analyzer is configured to use Weaviate
            self.assertTrue(analyzer.is_weaviate)
            
            # Test file search (simplified test)
            results = analyzer.search_relevant_files("test query")
            
            # Verify results
            self.assertEqual(len(results), 2)
            self.assertEqual(results[0][0], "file1.py")
            self.assertEqual(results[0][1], "def test(): pass")

if __name__ == "__main__":
    unittest.main() 