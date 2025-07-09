# UI Analyzer API Integration

This document explains how to set up and use the UI Analyzer API with the main application.

## Architecture

The system is composed of two main components:

1. **Node.js Express API** (this application) - handles user authentication, credits, and client requests
2. **Python FastAPI Analyzer** - performs the actual website analysis using AI and Lighthouse

## Setup Instructions

### 1. Configure the Python Analyzer API

Navigate to the agent directory:

```bash
cd apps/agent
```

Set up a Python virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

Create an environment file using the helper script:

```bash
./setup_env.sh
```

Or manually copy the example:

```bash
cp .env.example .env
# Edit .env with your API keys and settings
```

Start the analyzer API server:

```bash
./run_server.sh
```

### 2. Configure the Node.js Express API

Navigate to the API directory:

```bash
cd apps/api
```

Install dependencies:

```bash
npm install
```

Create an environment file:

```bash
cp .env.example .env
# Edit .env with your database connections and API keys
```

Make sure to set these environment variables:

```
ANALYZER_API_URL=http://localhost:8000
ANALYZER_API_KEY=your-secure-api-key-here
```

**Note:** The API now sends base64-encoded screenshots directly in the response, so you don't need to worry about file system access between services.

Start the API server:

```bash
npm run dev
```

## Testing the Integration

You can test the full integration by making a request to the Node.js API:

```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"url": "https://example.com"}'
```

## Production Deployment

For production deployment:

1. Run the FastAPI analyzer on a separate server with adequate resources
2. Configure the Node.js API to connect to the analyzer API via secure connections
3. Use proper API key authentication between services
4. Consider containerizing both services for easier deployment

## Troubleshooting

If you encounter issues:

1. Check that both services are running
2. Verify environment variables are correctly set
3. Check API key authentication
4. Examine the logs of both services for errors
