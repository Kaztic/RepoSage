"""
Tests for the GeminiClient class
"""
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from chatbot import GeminiClient

class TestGeminiClient(unittest.TestCase):
    """Test cases for the GeminiClient class."""
    
    @patch('google.generativeai.configure')
    @patch('google.generativeai.list_models')
    @patch('google.generativeai.GenerativeModel')
    def setUp(self, mock_model, mock_list_models, mock_configure):
        """Set up test fixtures."""
        self.mock_configure = mock_configure
        self.mock_model_class = mock_model
        self.mock_model = mock_model.return_value
        self.mock_list_models = mock_list_models
        
        # Mock list_models to simulate available models
        mock_model_obj = MagicMock()
        mock_model_obj.name = 'models/gemini-2.0-flash'
        self.mock_list_models.return_value = [mock_model_obj]
        
        # Create client with mocked components
        self.client = GeminiClient('fake-api-key')
    
    def test_initialization(self):
        """Test client initialization."""
        # Verify API key was configured
        self.mock_configure.assert_called_once_with(api_key='fake-api-key')
        
        # Verify list_models was called
        self.mock_list_models.assert_called_once()
        
        # Verify model was created with the right name
        self.mock_model_class.assert_any_call('models/gemini-2.0-flash')
        
        # Verify client attributes
        self.assertEqual(self.client.model, self.mock_model)
    
    def test_generate_response_success(self):
        """Test successful response generation."""
        # Set up mock response
        mock_response = MagicMock()
        mock_response.text = "This is a test response"
        self.mock_model.generate_content.return_value = mock_response
        
        # Call the method
        response = self.client.generate_response("What is this project?", '{"info": "test"}')
        
        # Verify the result
        self.assertEqual(response, "This is a test response")
        
        # Verify model was called with correct prompt
        self.mock_model.generate_content.assert_called_once()
        call_args = self.mock_model.generate_content.call_args[0][0]
        self.assertIn("You are RepoSage", call_args)
        self.assertIn("What is this project?", call_args)
        self.assertIn('{"info": "test"}', call_args)
    
    def test_generate_response_error(self):
        """Test error handling in response generation."""
        # Set up mock to raise exception
        self.mock_model.generate_content.side_effect = Exception("API Error")
        
        # Call the method
        response = self.client.generate_response("What is this project?", '{"info": "test"}')
        
        # Verify error response
        self.assertIn("I'm sorry, I encountered an error", response)


if __name__ == '__main__':
    unittest.main() 