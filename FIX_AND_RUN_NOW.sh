#!/bin/bash

# Fix npm permissions and install everything

echo "🔧 Fixing npm permissions..."
sudo chown -R $(whoami) /opt/homebrew/lib/node_modules/npm 2>/dev/null || echo "⚠️  Could not fix npm permissions - you may need to run: sudo chown -R $(whoami) /opt/homebrew/lib/node_modules/npm"

echo ""
echo "📦 Installing backend dependencies..."
cd /Users/admin/Projects/ai/apps/backend
npm install

echo ""
echo "📦 Installing frontend dependencies..."
cd ../web
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

echo ""
echo "🔄 Running migrations..."
cd ../backend
npm run migrate

echo ""
echo "🚀 Starting backend..."
npm run dev &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 3

echo ""
echo "🚀 Starting frontend..."
cd ../web
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Servers starting!"
echo ""
echo "📍 Frontend: http://localhost:5173"
echo "📍 Backend:  http://localhost:3001"
echo ""
echo "🛑 To stop: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Opening browser..."
sleep 5
open http://localhost:5173 2>/dev/null || echo "Please open http://localhost:5173 manually"
