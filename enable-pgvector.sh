#!/bin/bash

# Enable pgvector Extension
# This script enables the pgvector extension in your PostgreSQL database

echo "🔧 Enabling pgvector Extension..."
echo ""

# Try to get database URL from environment or use default
if [ -f "apps/backend/.env" ]; then
    source apps/backend/.env
fi

DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/aegis_ai"}

echo "Database URL: ${DATABASE_URL}"
echo ""

# Extract database name from URL
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

echo "Connecting to database: $DB_NAME"
echo ""

# Try to create extension
if psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1; then
    echo ""
    echo "✅ pgvector extension enabled!"
    echo ""
    echo "Verifying installation..."
    psql "$DATABASE_URL" -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';" 2>&1
    echo ""
    echo "🎉 pgvector is now active!"
    echo ""
    echo "Next steps:"
    echo "  1. Restart your backend: cd apps/backend && npm run dev"
    echo "  2. Re-upload documents to create vector embeddings"
    echo "  3. Test chat - it should be faster and more accurate now!"
else
    echo ""
    echo "❌ Failed to enable extension"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Make sure PostgreSQL is running"
    echo "  2. Check DATABASE_URL in apps/backend/.env"
    echo "  3. Try manually: psql -d aegis_ai -c 'CREATE EXTENSION vector;'"
fi
