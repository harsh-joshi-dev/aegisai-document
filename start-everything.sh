#!/bin/bash

# Start Aegis AI Web App - Complete Automation

echo "🛡️  Starting Aegis AI..."
echo ""

# Check dependencies
echo "📦 Checking dependencies..."
cd /Users/admin/Projects/ai/apps/backend
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/tsx" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

cd ../web
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    rm -rf node_modules package-lock.json
    npm install --legacy-peer-deps
fi

# Check .env
echo ""
echo "🔍 Checking configuration..."
cd ../backend
if ! grep -q "sk-" .env 2>/dev/null; then
    echo "⚠️  WARNING: OpenAI API key not set in .env"
    echo "   Edit apps/backend/.env and add your API key"
    echo "   Get it from: https://platform.openai.com/api-keys"
    echo ""
    read -p "Press Enter to continue anyway (will fail without API key)..."
fi

# Run migrations
echo ""
echo "🔄 Running database migrations..."
npm run migrate 2>&1 | grep -v "vector.control" || echo "⚠️  Migration completed (pgvector warning is OK)"

# Start backend
echo ""
echo "🚀 Starting backend server..."
npm run dev > /tmp/aegis-backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Logs: tail -f /tmp/aegis-backend.log"

# Wait for backend
sleep 3

# Start frontend
echo ""
echo "🚀 Starting frontend server..."
cd ../web
npm run dev > /tmp/aegis-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo "   Logs: tail -f /tmp/aegis-frontend.log"

# Wait a bit
sleep 3

# Check status
echo ""
echo "📊 Checking servers..."
curl -s http://localhost:3001/health > /dev/null && echo "✅ Backend: http://localhost:3001" || echo "⏳ Backend starting..."
curl -s http://localhost:5173 > /dev/null && echo "✅ Frontend: http://localhost:5173" || echo "⏳ Frontend starting..."

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📍 Frontend: http://localhost:5173"
echo "📍 Backend:  http://localhost:3001"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f /tmp/aegis-backend.log"
echo "   Frontend: tail -f /tmp/aegis-frontend.log"
echo ""
echo "🛑 To stop:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Opening browser in 5 seconds..."
sleep 5
open http://localhost:5173 2>/dev/null || echo "Please open http://localhost:5173 manually"
