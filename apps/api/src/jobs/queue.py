"""Job queue management with BullMQ"""
from typing import Dict, Any, Optional
import json
import asyncio
from urllib.parse import urlparse
from ..config import settings
from .processor import process_analysis_job

# Try to import BullMQ, fallback to simple queue if not available
try:
    from bullmq import Queue, Worker, QueueEvents
    BULLMQ_AVAILABLE = True
except ImportError:
    BULLMQ_AVAILABLE = False
    print("⚠️  BullMQ not available, using simple in-memory queue")

# Global queue instances
queue: Optional[Any] = None
worker: Optional[Any] = None
queue_events: Optional[Any] = None

# Simple in-memory queue fallback
_in_memory_queue: list = []
_in_memory_processing: Dict[str, Any] = {}

async def init_queue():
    """Initialize job queue and worker"""
    global queue, worker, queue_events
    
    if BULLMQ_AVAILABLE:
        # Parse Redis URL
        parsed = urlparse(settings.REDIS_URL)
        connection = {
            "host": parsed.hostname or "localhost",
            "port": parsed.port or 6379,
        }
        
        # Create queue
        queue = Queue("analysis", connection=connection)
        
        # Create worker
        worker = Worker(
            "analysis",
            process_analysis_job,
            connection=connection,
            concurrency=5,  # Process 5 jobs concurrently
        )
        
        # Create queue events for monitoring
        queue_events = QueueEvents("analysis", connection=connection)
        
        print("✅ Job queue initialized (BullMQ)")
    else:
        print("✅ Job queue initialized (in-memory fallback)")
        # Start background processor
        asyncio.create_task(_process_queue_background())

async def close_queue():
    """Close queue connections"""
    global queue, worker, queue_events
    
    if BULLMQ_AVAILABLE:
        if worker:
            await worker.close()
        if queue:
            await queue.close()
        if queue_events:
            await queue_events.close()
    
    print("✅ Job queue closed")

async def _process_queue_background():
    """Background processor for in-memory queue"""
    while True:
        if _in_memory_queue:
            job_data = _in_memory_queue.pop(0)
            job_id = job_data["job_id"]
            _in_memory_processing[job_id] = {"status": "processing"}
            try:
                await process_analysis_job({"data": job_data})
                _in_memory_processing[job_id] = {"status": "completed"}
            except Exception as e:
                _in_memory_processing[job_id] = {"status": "failed", "error": str(e)}
        await asyncio.sleep(1)

async def add_analysis_job(
    job_id: str,
    file_content: bytes,
    filename: str,
    webhook_url: Optional[str] = None,
    options: Dict[str, Any] = None,
    api_key: str = None,
):
    """Add an analysis job to the queue"""
    job_data = {
        "job_id": job_id,
        "filename": filename,
        "file_content": file_content.hex(),  # Store as hex string
        "webhook_url": webhook_url,
        "options": options or {},
        "api_key": api_key,
    }
    
    if BULLMQ_AVAILABLE and queue:
        await queue.add(
            "analyze",
            job_data,
            job_id=job_id,
            attempts=3,  # Retry up to 3 times
            backoff={
                "type": "exponential",
                "delay": 2000,  # Start with 2s delay
            },
        )
    else:
        # Use in-memory queue
        _in_memory_queue.append(job_data)
        _in_memory_processing[job_id] = {"status": "pending"}
    
    return job_id

async def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    """Get status of a job"""
    if BULLMQ_AVAILABLE and queue:
        job = await queue.getJob(job_id)
        if not job:
            return None
        
        state = await job.getState()
        progress = await job.getProgress()
        
        return {
            "job_id": job_id,
            "status": state,
            "progress": progress,
            "data": await job.getData(),
        }
    else:
        # Check in-memory processing
        if job_id in _in_memory_processing:
            return {
                "job_id": job_id,
                "status": _in_memory_processing[job_id].get("status", "unknown"),
                "progress": None,
                "data": _in_memory_processing[job_id],
            }
        return None
