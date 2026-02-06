"""Job processor for analysis tasks"""
import httpx
import json
from typing import Dict, Any
from ..config import settings
from ..webhooks.delivery import deliver_webhook

async def process_analysis_job(job: Dict[str, Any]):
    """Process an analysis job"""
    job_id = job["data"]["job_id"]
    filename = job["data"]["filename"]
    file_content_hex = job["data"]["file_content"]
    webhook_url = job["data"].get("webhook_url")
    options = job["data"].get("options", {})
    
    # Convert hex back to bytes
    file_content = bytes.fromhex(file_content_hex)
    
    try:
        # Call existing backend API
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {"file": (filename, file_content, "application/pdf")}
            
            response = await client.post(
                f"{settings.BACKEND_API_URL}/api/upload",
                files=files,
            )
            
            if response.status_code != 200:
                raise Exception(f"Backend API error: {response.text}")
            
            result = response.json()
            
            # Format result for API response
            analysis_result = {
                "job_id": job_id,
                "status": "completed",
                "result": {
                    "document_id": result["document"]["id"],
                    "filename": result["document"]["filename"],
                    "risk_level": result["document"]["riskLevel"],
                    "risk_category": result["document"].get("riskCategory", "None"),
                    "risk_confidence": result["document"].get("riskConfidence", 0),
                    "risk_explanation": result["document"].get("riskExplanation", ""),
                    "recommendations": result["document"].get("recommendations", []),
                    "num_pages": result["document"]["numPages"],
                    "num_chunks": result["document"]["numChunks"],
                    "metadata": {},
                },
            }
            
            # Deliver webhook if provided
            if webhook_url:
                await deliver_webhook(
                    webhook_url=webhook_url,
                    event="analysis.completed",
                    data=analysis_result,
                )
            
            return analysis_result
            
    except Exception as e:
        error_result = {
            "job_id": job_id,
            "status": "failed",
            "error": str(e),
        }
        
        # Deliver error webhook if provided
        if webhook_url:
            await deliver_webhook(
                webhook_url=webhook_url,
                event="analysis.failed",
                data=error_result,
            )
        
        raise  # Re-raise to trigger retry
