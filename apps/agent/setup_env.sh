#!/bin/bash
set -e

# Helper script to create a .env file from .env.example if it doesn't exist

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "📄 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your actual API keys and configuration."
    echo "   You can start the server with ./run_server.sh after updating the .env file."
    exit 0
elif [ ! -f ".env" ] && [ ! -f ".env.example" ]; then
    echo "❌ No .env.example file found. Cannot create .env file."
    exit 1
else
    echo "✅ .env file already exists."
    exit 0
fi
