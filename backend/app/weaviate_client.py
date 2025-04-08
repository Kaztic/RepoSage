import weaviate
from app.config import settings

def get_weaviate_client() -> weaviate.Client:
    """Initialize and return a Weaviate client."""
    client = weaviate.Client(
        url=settings.WEAVIATE_URL,
        # Add API key if configured
        auth_client_secret=weaviate.AuthApiKey(api_key=settings.WEAVIATE_API_KEY) if settings.WEAVIATE_API_KEY else None
    )
    
    # Create schema if it doesn't exist
    if not client.schema.exists("RepositoryFile"):
        schema = {
            "classes": [{
                "class": "RepositoryFile",
                "description": "A file from a repository",
                "vectorizer": "text2vec-transformers",
                "properties": [
                    {
                        "name": "file_path",
                        "dataType": ["string"],
                        "description": "Path of the file in the repository"
                    },
                    {
                        "name": "content",
                        "dataType": ["text"],
                        "description": "Content of the file"
                    },
                    {
                        "name": "repository_id",
                        "dataType": ["string"],
                        "description": "ID of the repository this file belongs to"
                    }
                ]
            }]
        }
        client.schema.create(schema)
    
    return client 