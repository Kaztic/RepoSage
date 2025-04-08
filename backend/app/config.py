import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings:
    # API Keys
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    
    # App Configuration
    PORT = int(os.getenv("PORT", "8000"))
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    
    # Database Configuration
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./reposage.db")
    
    # Cache and Task Queue
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Security Keys
    ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")
    SECRET_KEY = os.getenv("SECRET_KEY", "")
    
    # Repository Settings
    REPO_CACHE_SIZE = int(os.getenv("REPO_CACHE_SIZE", "10"))
    
    # Model Configuration
    DEFAULT_MODEL_PROVIDER = os.getenv("DEFAULT_MODEL_PROVIDER", "gemini")
    
    # Weaviate Configuration
    WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://localhost:8080")
    WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY", "")

# Create settings instance
settings = Settings() 