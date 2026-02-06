#!/bin/bash

# Aegis AI - Web App Setup Script
# This script sets up and runs the web app

set -e

echo "🛡️  Aegis AI - Web App Setup"
echo "============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Install backend dependencies
echo -e "${YELLOW}Step 1: Installing backend dependencies...${NC}"
cd apps/backend
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Backend dependencies already installed${NC}"
fi

# Step 2: Create .env file if it doesn't exist
echo ""
echo -e "${YELLOW}Step 2: Setting up environment variables...${NC}"
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://localhost:5432/aegis_ai

# OpenAI API (REQUIRED - Get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=your_openai_api_key_here

# Server
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173
EOF
    echo -e "${GREEN}✅ .env file created${NC}"
    echo -e "${RED}⚠️  IMPORTANT: Edit apps/backend/.env and add your OpenAI API key!${NC}"
    echo ""
    read -p "Press Enter after you've added your OpenAI API key to .env..."
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Step 3: Check database connection
echo ""
echo -e "${YELLOW}Step 3: Checking database setup...${NC}"
if command -v psql &> /dev/null; then
    echo "PostgreSQL found. Checking connection..."
    # Try to connect (this will fail gracefully if DB doesn't exist)
    if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw aegis_ai; then
        echo -e "${GREEN}✅ Database 'aegis_ai' exists${NC}"
    else
        echo -e "${YELLOW}⚠️  Database 'aegis_ai' not found${NC}"
        echo "Creating database..."
        read -p "Enter PostgreSQL username (default: $(whoami)): " db_user
        db_user=${db_user:-$(whoami)}
        createdb -U "$db_user" aegis_ai 2>/dev/null || echo "Database might already exist or you need to create it manually"
        psql -U "$db_user" -d aegis_ai -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || echo "Please run: CREATE EXTENSION IF NOT EXISTS vector;"
    fi
else
    echo -e "${RED}⚠️  PostgreSQL not found. Please install PostgreSQL first.${NC}"
    echo "macOS: brew install postgresql@14"
    echo "Then create database: createdb aegis_ai"
    echo "And enable extension: psql aegis_ai -c 'CREATE EXTENSION vector;'"
fi

# Step 4: Run migrations
echo ""
echo -e "${YELLOW}Step 4: Running database migrations...${NC}"
npm run migrate || {
    echo -e "${RED}❌ Migration failed. Make sure:${NC}"
    echo "  1. PostgreSQL is running"
    echo "  2. DATABASE_URL in .env is correct"
    echo "  3. Database exists and pgvector extension is installed"
    exit 1
}
echo -e "${GREEN}✅ Migrations completed${NC}"

# Step 5: Install frontend dependencies
echo ""
echo -e "${YELLOW}Step 5: Installing frontend dependencies...${NC}"
cd ../web
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Frontend dependencies already installed${NC}"
fi

# Step 6: Start services
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "To start the app, run these commands in separate terminals:"
echo ""
echo -e "${YELLOW}Terminal 1 - Backend:${NC}"
echo "  cd apps/backend"
echo "  npm run dev"
echo ""
echo -e "${YELLOW}Terminal 2 - Frontend:${NC}"
echo "  cd apps/web"
echo "  npm run dev"
echo ""
echo -e "${YELLOW}Then open:${NC} http://localhost:5173"
echo ""
read -p "Would you like to start the backend now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${GREEN}Starting backend...${NC}"
    echo "Press Ctrl+C to stop"
    echo ""
    cd ../backend
    npm run dev
fi
