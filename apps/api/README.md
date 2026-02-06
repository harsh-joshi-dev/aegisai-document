# Aegis AI Integration API

FastAPI service for external integrations (Email, Slack, Zapier, Folder Monitoring, etc.)

## Features

- ✅ RESTful API with API key authentication
- ✅ Async job processing with BullMQ
- ✅ Webhook delivery with retry logic
- ✅ Rate limiting per API key
- ✅ Integration with existing backend services

## Setup

### 1. Install Dependencies

```bash
cd apps/api
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start Redis (for job queue)

```bash
# macOS
brew install redis
brew services start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

### 4. Run the API

```bash
# Development
uvicorn src.main:app --reload --port 3002

# Production
uvicorn src.main:app --host 0.0.0.0 --port 3002
```

## API Endpoints

### Health Check
```
GET /health
```

### Analyze Document
```
POST /api/v1/analyze
Headers:
  X-API-Key: your_api_key_here
Body (multipart/form-data):
  file: <PDF file>
  webhook_url: https://example.com/callback (optional)
```

### Get Job Status
```
GET /api/v1/jobs/{job_id}
Headers:
  X-API-Key: your_api_key_here
```

### Webhook Management
```
POST /api/v1/webhooks
GET /api/v1/webhooks/{webhook_id}
DELETE /api/v1/webhooks/{webhook_id}
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:3002/docs
- ReDoc: http://localhost:3002/redoc

## Generating API Keys

For development, use the test key generator:

```python
from src.auth.api_keys import create_test_api_key
key = create_test_api_key()
print(f"API Key: {key}")
```

## Testing

```bash
# Test health endpoint
curl http://localhost:3002/health

# Test analyze endpoint
curl -X POST http://localhost:3002/api/v1/analyze \
  -H "X-API-Key: your_key_here" \
  -F "file=@document.pdf" \
  -F "webhook_url=https://example.com/callback"
```

## Architecture

```
API Request → Authentication → Job Queue → Worker → Backend API → Webhook
```

## Next Steps

1. ✅ API Foundation - Complete
2. ⏳ Email Forwarding - Next
3. ⏳ Slack/Teams Bot
4. ⏳ Zapier Integration
5. ⏳ Folder Monitoring
