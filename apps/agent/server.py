import os
import json
import asyncio
import base64
from typing import Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Header, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, HttpUrl
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import from our analyzer module
from analyzer import ChromiumPool, WebsiteAnalyzer
from config import default_config

# Create FastAPI app
app = FastAPI(
    title="UI Analyzer API",
    description="API for analyzing website UI and performance",
    version="1.0.0"
)

# Global pool for browser instances - to be initialized on startup
chromium_pool = None

# API key authentication
def verify_api_key(api_key: str = Header(None, alias="X-API-Key")):
    return True
    """Verify the API key from the request header"""
    expected_api_key = os.getenv("API_KEY")
    
    # No API key configured - development mode
    if not expected_api_key:
        return True
    
    # API key required but not provided
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is required",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    # API key doesn't match
    if api_key != expected_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    return True

# Request model
class AnalysisRequest(BaseModel):
    url: HttpUrl = Field(..., description="The website URL to analyze")
    save_screenshots: bool = Field(False, description="Whether to save screenshots permanently")

# Response model
class AnalysisResponse(BaseModel):
    url: str
    loadTime: float
    issues: list[str] = []
    screenshots: Dict[str, Dict[str, Optional[str]]] = {
        "paths": {"desktop": None, "mobile": None},
        "base64": {"desktop": None, "mobile": None}
    }
    lighthouse: Dict[str, Any] = {"available": False}

@app.on_event("startup")
async def startup_event():
    """Initialize the Chromium pool on startup"""
    global chromium_pool
    config = default_config
    config.validate()
    chromium_pool = ChromiumPool(
        max_browsers=config.max_browsers,
        max_tabs_per_browser=config.max_tabs_per_browser
    )
    await chromium_pool.start()
    print("✅ Chromium pool initialized")

@app.on_event("shutdown")
async def shutdown_event():
    """Close the Chromium pool on shutdown"""
    global chromium_pool
    if chromium_pool:
        await chromium_pool.close()
        print("✅ Chromium pool closed")

@app.post("/analyze", response_model=AnalysisResponse, dependencies=[Depends(verify_api_key)])
async def analyze_website(request: AnalysisRequest):
    """Analyze a website UI and performance"""
    global chromium_pool
    
    if not chromium_pool:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Browser pool not initialized"
        )
    
    config = default_config
    analyzer = WebsiteAnalyzer(
        save_screenshots=request.save_screenshots,
        chromium_pool=chromium_pool,
        config=config
    )
    
    try:
        url = str(request.url)
        results, load_time, lighthouse_data = await analyzer.analyze_website(url)
        
        # Extract issues from the results text
        issues_list = []
        if results and results.strip():
            for line in results.split("\n"):
                if line.strip():
                    issues_list.append(line.strip())
        
        # Get screenshot paths and base64 data
        desktop_path = None
        mobile_path = None
        desktop_base64 = None
        mobile_base64 = None
        
        if hasattr(analyzer, 'desktop_screenshot_path') and analyzer.desktop_screenshot_path:
            desktop_path = str(analyzer.desktop_screenshot_path)
            # Convert desktop screenshot to base64
            try:
                with open(desktop_path, "rb") as img_file:
                    desktop_base64 = base64.b64encode(img_file.read()).decode('utf-8')
            except Exception as e:
                print(f"Error encoding desktop screenshot: {e}")
        
        if hasattr(analyzer, 'mobile_screenshot_path') and analyzer.mobile_screenshot_path:
            mobile_path = str(analyzer.mobile_screenshot_path)
            # Convert mobile screenshot to base64
            try:
                with open(mobile_path, "rb") as img_file:
                    mobile_base64 = base64.b64encode(img_file.read()).decode('utf-8')
            except Exception as e:
                print(f"Error encoding mobile screenshot: {e}")
        
        # Create response data
        response_data = {
            "url": url,
            "loadTime": load_time,
            "issues": issues_list,
            "screenshots": {
                "paths": {
                    "desktop": desktop_path,
                    "mobile": mobile_path
                },
                "base64": {
                    "desktop": desktop_base64,
                    "mobile": mobile_base64
                }
            },
            "lighthouse": {
                "available": False
            }
        }
        
        # Add lighthouse data if available
        if lighthouse_data and lighthouse_data.get("available"):
            response_data["lighthouse"] = {
                "available": True,
                "performanceScore": lighthouse_data.get("performance_score"),
                "fcpSeconds": lighthouse_data.get("fcp_seconds"),
                "lcpSeconds": lighthouse_data.get("lcp_seconds"),
                "clsValue": lighthouse_data.get("cls_value"),
                "tbtMs": lighthouse_data.get("tbt_ms")
            }
        
        return response_data
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )

@app.get("/health", dependencies=[Depends(verify_api_key)])
async def health_check():
    """Check if the API is healthy"""
    global chromium_pool
    
    if not chromium_pool:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "error", "message": "Browser pool not initialized"}
        )
    
    return {"status": "ok", "message": "API is healthy"}

# Main entry point
if __name__ == "__main__":
    import uvicorn
    
    # Determine port from environment variable or default to 8000
    port = int(os.getenv("PORT", "8000"))
    
    # Check API key configuration
    api_key = os.getenv("API_KEY")
    if not api_key:
        print("⚠️  Warning: API_KEY environment variable not set")
        print("   API will run without authentication (development mode)")
    else:
        print("🔑 API Key authentication enabled")
    
    print(f"🚀 Starting UI Analyzer API on port {port}")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
