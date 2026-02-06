#!/bin/bash

# Stop Backend and Web App

echo "🛑 Stopping Aegis AI Application..."
echo ""

# Kill backend
if lsof -ti:3001 > /dev/null 2>&1; then
    echo "   Stopping backend (port 3001)..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    echo "   ✅ Backend stopped"
else
    echo "   Backend not running"
fi

# Kill web app
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "   Stopping web app (port 5173)..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    echo "   ✅ Web app stopped"
else
    echo "   Web app not running"
fi

# Kill by PIDs if files exist
if [ -f .backend.pid ]; then
    kill $(cat .backend.pid) 2>/dev/null
    rm .backend.pid
fi

if [ -f .web.pid ]; then
    kill $(cat .web.pid) 2>/dev/null
    rm .web.pid
fi

# Kill any remaining processes
pkill -f "tsx watch.*backend" 2>/dev/null
pkill -f "vite.*web" 2>/dev/null

echo ""
echo "✅ All services stopped"
