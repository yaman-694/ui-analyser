#!/bin/bash
set -e

echo "🚀 Running Website Analysis"
echo "=========================="

# Activate virtual environment
source .venv/bin/activate

# Run the analyzer
python analyzer.py "$@"

echo ""
echo "✅ Analysis completed!"
