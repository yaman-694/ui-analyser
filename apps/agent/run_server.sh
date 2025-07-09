#!/bin/bash
set -e

echo "🚀 Starting UI Analyzer API Server"
echo "=================================="

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    echo "📦 Activating virtual environment..."
    source .venv/bin/activate
fi

# Check if requirements need to be installed
if ! command -v uvicorn &> /dev/null || ! python -c "import fastapi" &> /dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
fi

# Check if .env file exists
if [ -f ".env" ]; then
    echo "📄 Found .env file - environment variables will be loaded by the application"
else
    echo "⚠️  No .env file found, using default values"
    echo "   You can create one by running ./setup_env.sh"
fi

# Get PORT from environment if set, otherwise use default
PORT=${PORT:-8000}
echo "🌐 Starting server on port ${PORT}..."

# Start the server
uvicorn server:app --host 0.0.0.0 --port $PORT

echo ""
echo "✅ Server stopped"
