# UI Analyzer API

A FastAPI server that analyzes websites for UI and performance issues using AI vision.

## Features

- ✅ Website screenshot capture (desktop and mobile)
- ✅ AI-powered UI analysis
- ✅ Performance metrics via Lighthouse
- ✅ API key authentication
- ✅ Docker integration for Lighthouse audits

## Requirements

- Python 3.8+
- Docker (for Lighthouse performance analysis)
- An OpenAI API key with GPT-4 Vision access

## Setup

1. Create a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

4. Install Playwright browsers:

```bash
playwright install chromium
```

## Running the API Server

Start the API server:

```bash
./run_server.sh
```

Or manually:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

## API Usage

### Analyze Website

```http
POST /analyze
Content-Type: application/json
X-API-Key: your-api-key-here

{
  "url": "https://example.com",
  "save_screenshots": true
}
```

#### Response

```json
{
  "url": "https://example.com",
  "loadTime": 1.25,
  "issues": [
    "Low contrast text detected in header",
    "Mobile navigation is difficult to use"
  ],
  "screenshots": {
    "desktop": "/path/to/desktop_screenshot.png",
    "mobile": "/path/to/mobile_screenshot.png"
  },
  "lighthouse": {
    "available": true,
    "performanceScore": 85,
    "fcpSeconds": 1.2,
    "lcpSeconds": 2.3,
    "clsValue": 0.05,
    "tbtMs": 350
  }
}
```

### Health Check

```http
GET /health
X-API-Key: your-api-key-here
```

#### Response

```json
{
  "status": "ok",
  "message": "API is healthy"
}
```

## API Documentation

When the server is running, access the auto-generated API documentation:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Command Line Usage

You can still use the analyzer directly from the command line:

```bash
./run.sh https://example.com [--save-screenshots] [--json]
```

## Environment Variables

Configure the application using environment variables in `.env`:

- `API_KEY`: Required for API authentication
- `PORT`: Server port (default: 8000)
- `OPENAI_API_KEY`: OpenAI API key for AI analysis
- `AI_MODEL`: AI model to use (default: gpt-4-vision-preview)
- `MAX_BROWSERS`: Maximum Chromium browser instances (default: 4)
- `AUTO_START_DOCKER`: Automatically start Docker if not running (default: true)
