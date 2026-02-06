"""API Key management"""
from typing import Optional, Dict
from datetime import datetime, timedelta
import hashlib
import secrets

# In-memory storage (replace with database in production)
API_KEYS: Dict[str, Dict] = {}

def generate_api_key() -> tuple[str, str]:
    """Generate a new API key pair (key, secret)"""
    key_id = f"key_{secrets.token_urlsafe(16)}"
    secret = secrets.token_urlsafe(32)
    full_key = f"{key_id}_{secret}"
    
    # Hash the secret for storage
    hashed = hashlib.sha256(secret.encode()).hexdigest()
    
    # Store key info
    API_KEYS[key_id] = {
        "key_id": key_id,
        "hashed_secret": hashed,
        "created_at": datetime.utcnow(),
        "last_used": None,
        "rate_limit": 100,  # requests per minute
        "tier": "free",  # free, pro, enterprise
        "active": True,
    }
    
    return key_id, full_key

async def validate_api_key(api_key: str) -> Optional[Dict]:
    """Validate an API key and return key info"""
    # Parse key format: key_id_secret
    parts = api_key.split("_", 1)
    if len(parts) != 2:
        return None
    
    key_id, secret = parts
    
    # Look up key
    key_info = API_KEYS.get(key_id)
    if not key_info or not key_info.get("active"):
        return None
    
    # Verify secret
    hashed = hashlib.sha256(secret.encode()).hexdigest()
    if hashed != key_info["hashed_secret"]:
        return None
    
    # Update last used
    key_info["last_used"] = datetime.utcnow()
    
    return key_info

async def get_api_key_info(api_key: str) -> Optional[Dict]:
    """Get API key information without validating"""
    parts = api_key.split("_", 1)
    if len(parts) != 2:
        return None
    
    key_id = parts[0]
    return API_KEYS.get(key_id)

def create_test_api_key() -> str:
    """Create a test API key for development"""
    key_id, full_key = generate_api_key()
    return full_key
