"""Webhook delivery system"""
import httpx
import hmac
import hashlib
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from ..config import settings

async def deliver_webhook(
    webhook_url: str,
    event: str,
    data: Dict[str, Any],
    secret: Optional[str] = None,
    retry_count: int = 0,
) -> bool:
    """
    Deliver a webhook with retry logic and signature verification.
    
    Returns True if successful, False otherwise.
    """
    payload = {
        "event": event,
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    # Generate signature if secret provided
    headers = {
        "Content-Type": "application/json",
        "X-Aegis-Event": event,
    }
    
    if secret:
        signature = generate_signature(payload, secret)
        headers["X-Aegis-Signature"] = f"sha256={signature}"
    
    try:
        async with httpx.AsyncClient(timeout=settings.WEBHOOK_TIMEOUT) as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers=headers,
            )
            
            if response.status_code in [200, 201, 202]:
                return True
            else:
                # Retry on failure
                if retry_count < settings.WEBHOOK_MAX_RETRIES:
                    await asyncio.sleep(settings.WEBHOOK_RETRY_DELAY * (retry_count + 1))
                    return await deliver_webhook(
                        webhook_url, event, data, secret, retry_count + 1
                    )
                return False
                
    except Exception as e:
        print(f"Webhook delivery error: {e}")
        # Retry on exception
        if retry_count < settings.WEBHOOK_MAX_RETRIES:
            await asyncio.sleep(settings.WEBHOOK_RETRY_DELAY * (retry_count + 1))
            return await deliver_webhook(
                webhook_url, event, data, secret, retry_count + 1
            )
        return False

def generate_signature(payload: Dict[str, Any], secret: str) -> str:
    """Generate HMAC signature for webhook payload"""
    payload_str = json.dumps(payload, sort_keys=True)
    signature = hmac.new(
        secret.encode(),
        payload_str.encode(),
        hashlib.sha256,
    ).hexdigest()
    return signature

def verify_signature(payload: Dict[str, Any], signature: str, secret: str) -> bool:
    """Verify webhook signature"""
    expected = generate_signature(payload, secret)
    return hmac.compare_digest(signature, expected)
