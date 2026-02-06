#!/bin/bash

# Aegis AI - Start Web App
# This script starts both backend and frontend

echo "🛡️  Starting Aegis AI Web App..."
echo ""

# Check if .env exists and has API key
if [ -f "apps/backend/.env" ]; then
    if grep -q "your_openai_api_key_here" apps/backend/.env; then
        echo "⚠️  WARNING: Please edit apps/backend/.env and add your OpenAI API key!"
        echo "   Get it from: https://platform.openai.com/api-keys"
        echo ""
        read -p "Press Enter to continue anyway (will fail without API key)..."
    fi
else
    echo "❌ .env file not found in apps/backend/"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "apps/backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd apps/backend
    npm install
    cd ../..
fi

if [ ! -d "apps/web/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd apps/web
    npm install
    cd ../..
fi

# Check database
echo ""
echo "🔍 Checking database..."
if command -v psql &> /dev/null; then
    if pg_isready &> /dev/null; then
        echo "✅ PostgreSQL is running"
        
        # Try to create database if it doesn't exist
        createdb aegis_ai 2>/dev/null && echo "✅ Database created" || echo "ℹ️  Database might already exist"
        
        # Try to add extension
        psql aegis_ai -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null && echo "✅ pgvector extension ready" || echo "⚠️  Could not add pgvector extension"
    else
        echo "⚠️  PostgreSQL is not running"
        echo "   Start it with: brew services start postgresql@14"
    fi
else
    echo "⚠️  PostgreSQL not found in PATH"
fi

# Run migrations
echo ""
echo "🔄 Running database migrations..."
cd apps/backend
npm run migrate 2>&1 || echo "⚠️  Migration failed - check database connection"
cd ../..

# Start backend in background
echo ""
echo "🚀 Starting backend server..."
cd apps/backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Logs: apps/backend.log"
cd ../..

# Wait a bit for backend to start
sleep 3

# Start frontend
echo ""
echo "🚀 Starting frontend server..."
cd apps/web
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo "   Logs: apps/web.log"
cd ../..

echo ""
echo "✅ Web app starting!"
echo ""
echo "📍 Backend:  http://localhost:3001"
echo "📍 Frontend: http://localhost:5173"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f apps/backend.log"
echo "   Frontend: tail -f apps/frontend.log"
echo ""
echo "🛑 To stop:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Opening browser in 5 seconds..."
sleep 5
open http://localhost:5173 2>/dev/null || echo "Please open http://localhost:5173 manually"
