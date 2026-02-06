"""Configuration settings"""
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 3002
    DEBUG: bool = False
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]
    
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/aegis_ai"
    
    # Redis (for job queue)
    REDIS_URL: str = "redis://localhost:6379"
    
    # Backend API (existing Express service)
    BACKEND_API_URL: str = "http://localhost:3001"
    
    # API Keys
    API_KEY_SECRET: str = "your-secret-key-change-in-production"
    
    # Webhooks
    WEBHOOK_TIMEOUT: int = 30
    WEBHOOK_MAX_RETRIES: int = 3
    WEBHOOK_RETRY_DELAY: int = 5
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
