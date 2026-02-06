"""API Key authentication middleware"""
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .api_keys import validate_api_key, get_api_key_info

security = HTTPBearer()

async def api_key_middleware(request: Request, call_next):
    """Middleware to validate API keys"""
    # Skip auth for health check
    if request.url.path in ["/health", "/docs", "/openapi.json", "/redoc"]:
        return await call_next(request)
    
    # Get API key from header
    api_key = request.headers.get("X-API-Key") or request.headers.get("Authorization", "").replace("Bearer ", "")
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Provide X-API-Key header or Authorization: Bearer <key>",
        )
    
    # Validate API key
    key_info = await validate_api_key(api_key)
    if not key_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    
    # Check rate limits
    if not await check_rate_limit(api_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )
    
    # Attach key info to request state
    request.state.api_key = api_key
    request.state.api_key_info = key_info
    
    return await call_next(request)

async def check_rate_limit(api_key: str) -> bool:
    """Check if API key has exceeded rate limit"""
    # TODO: Implement Redis-based rate limiting
    # For now, return True (no rate limiting)
    return True
