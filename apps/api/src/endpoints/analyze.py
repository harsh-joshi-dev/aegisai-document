"""Document analysis endpoint"""
from fastapi import APIRouter, UploadFile, File, Request, HTTPException, status
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
import uuid
from ..models.schemas import AnalyzeRequest, JobResponse
from ..jobs.queue import add_analysis_job

router = APIRouter()

@router.post("/analyze", response_model=JobResponse)
async def analyze_document(
    request: Request,
    file: UploadFile = File(..., description="PDF file to analyze"),
    webhook_url: str = None,
    options: dict = None,
):
    """
    Analyze a document for risk assessment.
    
    - **file**: PDF file to analyze
    - **webhook_url**: Optional webhook URL to call when analysis is complete
    - **options**: Optional analysis options
    
    Returns a job ID that can be used to check status.
    """
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported",
        )
    
    # Read file content
    file_content = await file.read()
    if len(file_content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )
    
    # Check file size (50MB limit)
    if len(file_content) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 50MB",
        )
    
    # Generate job ID
    job_id = f"job_{uuid.uuid4().hex[:16]}"
    
    # Get API key info for rate limiting
    api_key_info = request.state.api_key_info
    tier = api_key_info.get("tier", "free")
    
    # Estimate completion time based on file size
    estimated_seconds = max(10, len(file_content) // 100000)  # ~10s per 100KB
    estimated_completion = datetime.utcnow() + timedelta(seconds=estimated_seconds)
    
    # Add job to queue
    await add_analysis_job(
        job_id=job_id,
        file_content=file_content,
        filename=file.filename,
        webhook_url=webhook_url,
        options=options or {},
        api_key=request.state.api_key,
    )
    
    return JobResponse(
        job_id=job_id,
        status="processing",
        created_at=datetime.utcnow(),
        estimated_completion=estimated_completion,
    )
