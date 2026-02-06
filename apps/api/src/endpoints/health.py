"""Health check endpoint"""
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "aegis-ai-api",
        "timestamp": datetime.utcnow().isoformat(),
    }
