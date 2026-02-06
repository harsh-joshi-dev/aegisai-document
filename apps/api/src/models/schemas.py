"""Pydantic schemas for API requests/responses"""
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class RiskLevel(str, Enum):
    CRITICAL = "Critical"
    WARNING = "Warning"
    NORMAL = "Normal"

class RiskCategory(str, Enum):
    LEGAL = "Legal"
    FINANCIAL = "Financial"
    COMPLIANCE = "Compliance"
    OPERATIONAL = "Operational"
    NONE = "None"

class AnalyzeRequest(BaseModel):
    """Request to analyze a document"""
    webhook_url: Optional[HttpUrl] = Field(None, description="Webhook URL to call when analysis is complete")
    options: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Analysis options (include_chunks, include_embeddings, etc.)"
    )

class JobResponse(BaseModel):
    """Response with job information"""
    job_id: str
    status: str
    created_at: datetime
    estimated_completion: Optional[datetime] = None

class AnalysisResult(BaseModel):
    """Document analysis result"""
    document_id: str
    filename: str
    risk_level: RiskLevel
    risk_category: RiskCategory
    risk_confidence: int = Field(..., ge=0, le=100)
    risk_explanation: str
    recommendations: List[str]
    num_pages: int
    num_chunks: int
    metadata: Optional[Dict[str, Any]] = None

class JobStatusResponse(BaseModel):
    """Job status response"""
    job_id: str
    status: str  # pending, processing, completed, failed
    created_at: datetime
    completed_at: Optional[datetime] = None
    result: Optional[AnalysisResult] = None
    error: Optional[str] = None

class WebhookRequest(BaseModel):
    """Webhook registration request"""
    url: HttpUrl
    events: List[str] = Field(default_factory=lambda: ["analysis.completed"])
    secret: Optional[str] = None

class WebhookResponse(BaseModel):
    """Webhook registration response"""
    webhook_id: str
    url: str
    events: List[str]
    created_at: datetime
