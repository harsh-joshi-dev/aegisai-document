"""Webhook management endpoints"""
from fastapi import APIRouter
from ..models.schemas import WebhookRequest, WebhookResponse
from datetime import datetime
import uuid

router = APIRouter()

# In-memory storage (replace with database in production)
WEBHOOKS = {}

@router.post("/webhooks", response_model=WebhookResponse)
async def create_webhook(request: WebhookRequest):
    """
    Register a webhook URL to receive analysis events.
    
    - **url**: Webhook URL to call
    - **events**: List of events to subscribe to
    - **secret**: Optional secret for signature verification
    """
    webhook_id = f"wh_{uuid.uuid4().hex[:16]}"
    
    WEBHOOKS[webhook_id] = {
        "webhook_id": webhook_id,
        "url": str(request.url),
        "events": request.events,
        "secret": request.secret,
        "created_at": datetime.utcnow(),
        "active": True,
    }
    
    return WebhookResponse(
        webhook_id=webhook_id,
        url=str(request.url),
        events=request.events,
        created_at=datetime.utcnow(),
    )

@router.get("/webhooks/{webhook_id}")
async def get_webhook(webhook_id: str):
    """Get webhook information"""
    webhook = WEBHOOKS.get(webhook_id)
    if not webhook:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )
    return webhook

@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str):
    """Delete a webhook"""
    if webhook_id in WEBHOOKS:
        del WEBHOOKS[webhook_id]
        return {"message": "Webhook deleted"}
    from fastapi import HTTPException, status
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Webhook not found",
    )
