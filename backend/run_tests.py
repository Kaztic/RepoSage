#!/usr/bin/env python3
"""
Run all RepoSage tests
"""

import unittest
import sys
import os

def run_tests():
    """Discover and run all tests."""
    # Add the parent directory to the path
    sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
    
    # Discover tests
    loader = unittest.TestLoader()
    start_dir = os.path.join(os.path.dirname(__file__), 'tests')
    suite = loader.discover(start_dir, pattern='test_*.py')
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Return appropriate exit code
    return 0 if result.wasSuccessful() else 1

if __name__ == '__main__':
    sys.exit(run_tests()) 