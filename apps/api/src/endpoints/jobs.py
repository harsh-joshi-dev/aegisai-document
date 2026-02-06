"""Job status endpoints"""
from fastapi import APIRouter, HTTPException, status
from ..models.schemas import JobStatusResponse
from ..jobs.queue import get_job_status
from datetime import datetime

router = APIRouter()

@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job(job_id: str):
    """
    Get the status of an analysis job.
    
    - **job_id**: The job ID returned from /analyze endpoint
    """
    job_info = await get_job_status(job_id)
    
    if not job_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    
    # Map BullMQ status to our status
    status_map = {
        "waiting": "pending",
        "active": "processing",
        "completed": "completed",
        "failed": "failed",
        "delayed": "pending",
    }
    
    job_status = status_map.get(job_info["status"], "unknown")
    
    # Get result from job data if completed
    result = None
    error = None
    
    if job_status == "completed":
        job_data = job_info.get("data", {})
        if "result" in job_data:
            result = job_data["result"]
    elif job_status == "failed":
        error = "Job processing failed"
    
    return JobStatusResponse(
        job_id=job_id,
        status=job_status,
        created_at=datetime.utcnow(),  # TODO: Get from job metadata
        completed_at=datetime.utcnow() if job_status in ["completed", "failed"] else None,
        result=result,
        error=error,
    )
