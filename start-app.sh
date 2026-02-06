#!/bin/bash

# Start Backend and Web App Together
# This script starts both services in the background

echo "🚀 Starting Aegis AI Application..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    lsof -ti:$1 > /dev/null 2>&1
}

# Check if backend port is available
if check_port 3001; then
    echo -e "${YELLOW}⚠️  Port 3001 is already in use${NC}"
    echo "   Backend might already be running"
    read -p "   Kill existing process and restart? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   Killing process on port 3001..."
        lsof -ti:3001 | xargs kill -9 2>/dev/null
        sleep 2
    else
        echo "   Using existing backend process"
        BACKEND_RUNNING=true
    fi
else
    BACKEND_RUNNING=false
fi

# Check if web port is available
if check_port 5173; then
    echo -e "${YELLOW}⚠️  Port 5173 is already in use${NC}"
    echo "   Web app might already be running"
    read -p "   Kill existing process and restart? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   Killing process on port 5173..."
        lsof -ti:5173 | xargs kill -9 2>/dev/null
        sleep 2
    else
        echo "   Using existing web app process"
        WEB_RUNNING=true
    fi
else
    WEB_RUNNING=false
fi

# Start Backend
if [ "$BACKEND_RUNNING" = false ]; then
    echo -e "${GREEN}📦 Starting Backend...${NC}"
    cd apps/backend
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "   Installing backend dependencies..."
        npm install
    fi
    
    # Start backend in background
    npm run dev > ../backend.log 2>&1 &
    BACKEND_PID=$!
    echo "   Backend starting (PID: $BACKEND_PID)"
    echo "   Logs: apps/backend.log"
    
    # Wait for backend to be ready
    echo "   Waiting for backend to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:3001/health > /dev/null 2>&1; then
            echo -e "   ${GREEN}✅ Backend is ready!${NC}"
            break
        fi
        sleep 1
    done
    
    cd ../..
fi

# Start Web App
if [ "$WEB_RUNNING" = false ]; then
    echo -e "${GREEN}🌐 Starting Web App...${NC}"
    cd apps/web
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "   Installing web dependencies..."
        npm install
    fi
    
    # Start web app in background
    npm run dev > ../web.log 2>&1 &
    WEB_PID=$!
    echo "   Web app starting (PID: $WEB_PID)"
    echo "   Logs: apps/web.log"
    
    # Wait for web app to be ready
    echo "   Waiting for web app to be ready..."
    sleep 3
    
    cd ../..
fi

echo ""
echo -e "${GREEN}✅ Application Started!${NC}"
echo ""
echo "📍 URLs:"
echo "   Backend:  http://localhost:3001"
echo "   Web App:  http://localhost:5173"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f apps/backend.log"
echo "   Web App:  tail -f apps/web.log"
echo ""
echo "🛑 To stop:"
echo "   pkill -f 'tsx watch'  # Stop backend"
echo "   pkill -f 'vite'        # Stop web app"
echo ""
echo "   Or: ./stop-app.sh"
echo ""

# Save PIDs to file
echo $BACKEND_PID > .backend.pid 2>/dev/null
echo $WEB_PID > .web.pid 2>/dev/null
