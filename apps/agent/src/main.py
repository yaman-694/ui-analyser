import os
import base64
import logging
from typing import Optional, Dict, Any, Union
from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, HttpUrl, ValidationError
from dotenv import load_dotenv
from pathlib import Path
from fastapi.responses import JSONResponse
from typing import Union
import asyncio
import traceback
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env file and print them for debugging
load_dotenv()

# Import from our analyzer module
from analyzer.analyzer import ChromiumPool, WebsiteAnalyzer
from config.config import default_config

# Create FastAPI app
app = FastAPI(
    title="UI Analyzer API",
    description="API for analyzing website UI and performance",
    version="1.0.0",
)

# Global pool for browser instances - to be initialized on startup
chromium_pool = None


# Custom exception classes for better error handling
class AnalysisError(Exception):
    """Base exception for analysis errors"""

    def __init__(
        self, message: str, error_code: str = "ANALYSIS_ERROR", status_code: int = 500
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(self.message)


class WebsiteAccessError(AnalysisError):
    """Exception for website access issues"""

    def __init__(self, message: str, url: str):
        super().__init__(message, "WEBSITE_ACCESS_ERROR", 400)
        self.url = url


class ResourceUnavailableError(AnalysisError):
    """Exception for resource unavailability"""

    def __init__(self, message: str):
        super().__init__(message, "RESOURCE_UNAVAILABLE", 503)


class ValidationError(AnalysisError):
    """Exception for validation errors"""

    def __init__(self, message: str):
        super().__init__(message, "VALIDATION_ERROR", 400)


# Request model with enhanced validation
class AnalysisRequest(BaseModel):
    url: HttpUrl = Field(..., description="The website URL to analyze")
    save_screenshots: bool = Field(
        False, description="Whether to save screenshots permanently"
    )

    def validate_url(self) -> None:
        """Additional URL validation"""
        url_str = str(self.url)

        # Check for common issues
        if not url_str.startswith(("http://", "https://")):
            raise ValidationError("URL must start with http:// or https://")

        # Check for localhost/private IPs (security consideration)
        if any(
            blocked in url_str.lower()
            for blocked in ["localhost", "127.0.0.1", "0.0.0.0"]
        ):
            raise ValidationError("Localhost and private IP addresses are not allowed")

        # Check URL length
        if len(url_str) > 2048:
            raise ValidationError("URL is too long (maximum 2048 characters)")


# Enhanced response models
class AnalysisResponse(BaseModel):
    url: str
    loadTime: float
    issues: list[str] = []
    screenshots: Dict[str, Dict[str, Optional[str]]] = {
        "paths": {"desktop": None, "mobile": None},
        "base64": {"desktop": None, "mobile": None},
    }
    lighthouse: Dict[str, Any] = {"available": False}


class ErrorResponse(BaseModel):
    error: bool = True
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: str


@app.on_event("startup")
async def startup_event():
    """Initialize the Chromium pool on startup"""
    global chromium_pool
    try:
        config = default_config
        config.validate()
        chromium_pool = ChromiumPool(
            max_browsers=config.max_browsers,
            max_tabs_per_browser=config.max_tabs_per_browser,
        )
        await chromium_pool.start()
        logger.info("✅ Chromium pool initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Chromium pool: {e}")
        chromium_pool = None


@app.on_event("shutdown")
async def shutdown_event():
    """Close the Chromium pool on shutdown"""
    global chromium_pool
    if chromium_pool:
        try:
            await chromium_pool.close()
            logger.info("✅ Chromium pool closed successfully")
        except Exception as e:
            logger.error(f"❌ Error closing Chromium pool: {e}")


def create_error_response(error: AnalysisError) -> ErrorResponse:
    """Create a structured error response"""
    return ErrorResponse(
        error_code=error.error_code,
        message=error.message,
        details={"status_code": error.status_code},
        timestamp=datetime.now().isoformat(),
    )


async def cleanup_screenshots_on_error(analyzer: WebsiteAnalyzer) -> None:
    """Clean up screenshots in case of error"""
    try:
        if (
            hasattr(analyzer, "desktop_screenshot_path")
            and analyzer.desktop_screenshot_path
        ):
            if analyzer.desktop_screenshot_path.exists():
                analyzer.desktop_screenshot_path.unlink()
                logger.info("Cleaned up desktop screenshot on error")

        if (
            hasattr(analyzer, "mobile_screenshot_path")
            and analyzer.mobile_screenshot_path
        ):
            if analyzer.mobile_screenshot_path.exists():
                analyzer.mobile_screenshot_path.unlink()
                logger.info("Cleaned up mobile screenshot on error")
    except Exception as e:
        logger.warning(f"Failed to cleanup screenshots on error: {e}")


async def encode_screenshot_to_base64(file_path: Path) -> Optional[str]:
    """Safely encode screenshot to base64 with error handling"""
    try:
        if not file_path or not file_path.exists():
            return None

        with open(file_path, "rb") as img_file:
            return base64.b64encode(img_file.read()).decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to encode screenshot {file_path}: {e}")
        return None


@app.post(
    "/analyze",
    response_model=Union[AnalysisResponse, ErrorResponse],
)
async def analyze_website(request: AnalysisRequest):
    """Analyze a website UI and performance with enhanced error handling"""
    analyzer = None
    start_time = datetime.now()

    try:
        # Step 1: Validate request
        logger.info(f"Starting analysis for URL: {request.url}")
        request.validate_url()

        # Step 2: Check resource availability
        if not chromium_pool:
            raise ResourceUnavailableError(
                "Browser pool not initialized. Please try again later."
            )

        # Step 3: Initialize analyzer
        config = default_config
        analyzer = WebsiteAnalyzer(
            save_screenshots=request.save_screenshots,
            chromium_pool=chromium_pool,
            config=config,
        )

        # Step 4: Perform analysis with timeout
        url = str(request.url)
        try:
            results, load_time, lighthouse_data = await asyncio.wait_for(
                analyzer.analyze_website(url), timeout=300  # 5 minute timeout
            )
        except asyncio.TimeoutError:
            raise AnalysisError(
                "Analysis timed out after 5 minutes. The website may be too slow or unresponsive.",
                "TIMEOUT_ERROR",
                408,
            )

        # Step 5: Handle Lighthouse errors
        if isinstance(results, dict) and "lighthouse_error" in results:
            logger.warning(f"Lighthouse analysis failed: {results['lighthouse_error']}")
            return create_error_response(
                AnalysisError(
                    f"Performance analysis failed: {results['lighthouse_error']}",
                    "LIGHTHOUSE_ERROR",
                    422,
                )
            )

        # Step 6: Process results
        issues_list = []
        if results and isinstance(results, str) and results.strip():
            issues_list = [line.strip() for line in results.split("\n") if line.strip()]

        # Step 7: Encode screenshots with error handling
        desktop_base64 = None
        mobile_base64 = None

        if (
            hasattr(analyzer, "desktop_screenshot_path")
            and analyzer.desktop_screenshot_path
        ):
            desktop_base64 = await encode_screenshot_to_base64(
                analyzer.desktop_screenshot_path
            )

        if (
            hasattr(analyzer, "mobile_screenshot_path")
            and analyzer.mobile_screenshot_path
        ):
            mobile_base64 = await encode_screenshot_to_base64(
                analyzer.mobile_screenshot_path
            )

        # Step 8: Build response
        response_data = {
            "url": url,
            "loadTime": load_time,
            "issues": issues_list,
            "screenshots": {
                "paths": {
                    "desktop": (
                        str(analyzer.desktop_screenshot_path)
                        if hasattr(analyzer, "desktop_screenshot_path")
                        and analyzer.desktop_screenshot_path
                        else None
                    ),
                    "mobile": (
                        str(analyzer.mobile_screenshot_path)
                        if hasattr(analyzer, "mobile_screenshot_path")
                        and analyzer.mobile_screenshot_path
                        else None
                    ),
                },
                "base64": {"desktop": desktop_base64, "mobile": mobile_base64},
            },
            "lighthouse": {"available": False},
        }

        # Add lighthouse data if available
        if lighthouse_data and lighthouse_data.get("available"):
            response_data["lighthouse"] = {
                "available": True,
                "performanceScore": lighthouse_data.get("performance_score"),
                "fcpSeconds": lighthouse_data.get("fcp_seconds"),
                "lcpSeconds": lighthouse_data.get("lcp_seconds"),
                "clsValue": lighthouse_data.get("cls_value"),
                "tbtMs": lighthouse_data.get("tbt_ms"),
            }

        # Log successful analysis
        analysis_time = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"Analysis completed successfully in {analysis_time:.2f}s for {url}"
        )

        return response_data

    except ValidationError as e:
        logger.warning(f"Validation error for {request.url}: {e.message}")
        return create_error_response(e)

    except WebsiteAccessError as e:
        logger.warning(f"Website access error for {e.url}: {e.message}")
        return create_error_response(e)

    except ResourceUnavailableError as e:
        logger.error(f"Resource unavailable: {e.message}")
        return create_error_response(e)

    except AnalysisError as e:
        logger.error(f"Analysis error for {request.url}: {e.message}")
        return create_error_response(e)

    except asyncio.TimeoutError:
        error = AnalysisError(
            "Request timed out. The analysis is taking longer than expected.",
            "TIMEOUT_ERROR",
            408,
        )
        logger.error(f"Timeout error for {request.url}: {error.message}")
        return create_error_response(error)

    except Exception as e:
        # Log the full traceback for unexpected errors
        logger.error(f"Unexpected error for {request.url}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")

        error = AnalysisError(
            "An unexpected error occurred during analysis. Please try again later.",
            "INTERNAL_ERROR",
            500,
        )
        return create_error_response(error)

    finally:
        # Cleanup on error if screenshots shouldn't be saved
        if analyzer and not request.save_screenshots:
            await cleanup_screenshots_on_error(analyzer)


@app.get("/health")
async def health_check():
    """Check if the API is healthy with detailed status"""
    try:
        health_status = {
            "status": "ok",
            "message": "API is healthy",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "chromium_pool": "available" if chromium_pool else "unavailable",
                "config": "valid" if default_config else "invalid",
            },
        }

        # Additional health checks
        if chromium_pool:
            try:
                # Quick test to ensure pool is responsive
                await chromium_pool.start()
                health_status["services"]["chromium_pool"] = "responsive"
            except Exception as e:
                health_status["services"]["chromium_pool"] = f"error: {str(e)}"
                health_status["status"] = "degraded"

        return health_status

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "message": "Health check failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
            },
        )


# Main entry point
if __name__ == "__main__":
    import uvicorn

    # Determine port from environment variable or default to 8000
    port = int(os.getenv("AGENT_PORT", "8000"))

    logger.info("🔒 Running in secure internal network mode")

    logger.info(f"🚀 Starting UI Analyzer API on port {port}")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
