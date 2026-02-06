#!/bin/bash

echo "Testing Upload API..."
echo ""

# Check if backend is running
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ Backend is not running!"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Create a simple text file to test
echo "This is a test document for upload testing." > /tmp/test.txt

echo "Testing upload endpoint..."
echo ""

# Test upload
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3001/api/upload \
  -F "file=@/tmp/test.txt" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "HTTP Status: $HTTP_CODE"
echo ""
echo "Response:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ Upload successful!"
else
    echo "❌ Upload failed with status $HTTP_CODE"
    echo ""
    echo "Check backend logs for details:"
    echo "  tail -50 apps/backend/backend_live.log"
fi
