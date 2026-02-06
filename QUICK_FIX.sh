#!/bin/bash

# Quick Fix Script for Aegis AI Web App

echo "🔧 Fixing Issues..."
echo ""

# Fix 1: Clean web app dependencies
echo "1. Cleaning web app dependencies..."
cd /Users/admin/Projects/ai/apps/web
rm -rf node_modules package-lock.json
echo "✅ Cleaned"

# Fix 2: Install web dependencies
echo ""
echo "2. Installing web dependencies..."
npm install
echo "✅ Web dependencies installed"

# Fix 3: Install backend dependencies (if needed)
echo ""
echo "3. Checking backend dependencies..."
cd ../backend
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
    echo "✅ Backend dependencies installed"
else
    echo "✅ Backend dependencies already installed"
fi

# Fix 4: Install pgvector (optional)
echo ""
echo "4. Installing pgvector extension..."
if brew list pgvector &>/dev/null; then
    echo "✅ pgvector already installed via Homebrew"
else
    echo "Attempting to install pgvector..."
    brew install pgvector 2>/dev/null || {
        echo "⚠️  Homebrew install failed. Building from source..."
        cd /tmp
        rm -rf pgvector
        git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git 2>/dev/null
        cd pgvector
        make 2>/dev/null && sudo make install 2>/dev/null || {
            echo "⚠️  pgvector installation failed. App will work without vector search."
        }
        cd /Users/admin/Projects/ai/apps/backend
    }
fi

# Fix 5: Add pgvector extension to database
echo ""
echo "5. Adding pgvector extension to database..."
psql aegis_ai -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null && {
    echo "✅ pgvector extension added"
} || {
    echo "⚠️  Could not add pgvector extension. App will work but vector search won't work."
    echo "   You can install pgvector later if needed."
}

echo ""
echo "✅ Fix Complete!"
echo ""
echo "Next steps:"
echo "1. Make sure .env file has your OpenAI API key:"
echo "   cd /Users/admin/Projects/ai/apps/backend"
echo "   nano .env"
echo ""
echo "2. Run migrations:"
echo "   cd /Users/admin/Projects/ai/apps/backend"
echo "   npm run migrate"
echo ""
echo "3. Start backend (Terminal 1):"
echo "   cd /Users/admin/Projects/ai/apps/backend"
echo "   npm run dev"
echo ""
echo "4. Start frontend (Terminal 2):"
echo "   cd /Users/admin/Projects/ai/apps/web"
echo "   npm run dev"
echo ""
echo "5. Open browser: http://localhost:5173"
