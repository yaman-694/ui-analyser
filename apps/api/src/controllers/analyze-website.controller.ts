/**
 * Controller for the website UI analysis endpoint
 *
 * This controller makes API requests to the Python-based FastAPI analyzer server
 * It handles both the HTTP response to the client and communication with the analyzer API
 *
 * The analyzer performs:
 * 1. Website screenshot capture using Playwright
 * 2. Performance analysis using Lighthouse
 * 3. AI-based UI analysis using vision models
 */
import axios, { AxiosError } from "axios";
import { NextFunction, Request, Response } from "express";
import fs from "fs";
import { HTTP_STATUS_CODE } from "../constants/constants";

// Types for the new error response format
interface AnalyzerErrorResponse {
  error: boolean;
  error_code: string;
  message: string;
  details?: {
    status_code: number;
  };
  timestamp: string;
}

interface AnalyzerSuccessResponse {
  url: string;
  loadTime: number;
  issues: string[];
  screenshots: {
    paths: {
      desktop: string | null;
      mobile: string | null;
    };
    base64: {
      desktop: string | null;
      mobile: string | null;
    };
  };
  lighthouse: {
    available: boolean;
    performanceScore?: number;
    fcpSeconds?: number;
    lcpSeconds?: number;
    clsValue?: number;
    tbtMs?: number;
  };
}

// Error code mapping to HTTP status codes
const ERROR_CODE_MAPPING: Record<string, number> = {
  VALIDATION_ERROR: HTTP_STATUS_CODE.BAD_REQUEST,
  WEBSITE_ACCESS_ERROR: HTTP_STATUS_CODE.BAD_REQUEST,
  RESOURCE_UNAVAILABLE: HTTP_STATUS_CODE.SERVICE_UNAVAILABLE,
  TIMEOUT_ERROR: HTTP_STATUS_CODE.GATEWAY_TIMEOUT,
  LIGHTHOUSE_ERROR: HTTP_STATUS_CODE.UNPROCESSABLE_ENTITY,
  ANALYSIS_ERROR: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
  INTERNAL_ERROR: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
};

export const analyzeUIController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { url } = req.body;
  const userId = req.userId;

  try {
    // Check for required environment variables
    const apiUrl = process.env.ANALYZER_API_URL || 'http://localhost:8000';
    console.log(`Making request to analyzer API at ${apiUrl} for URL: ${url}`);
    
    // Make request to the FastAPI analyzer service with timeout
    const response = await axios.post(
      `${apiUrl}/analyze`,
      { 
        url: url, 
        save_screenshots: true 
      },
      { 
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 300000, // 5 minutes timeout (matches agent server)
      }
    );
    
    // Process API response
    const analysisData = response.data;

    // Handle new structured error responses
    if (analysisData.error === true) {
      const errorResponse = analysisData as AnalyzerErrorResponse;
      console.error(`Analyzer API error (${errorResponse.error_code}): ${errorResponse.message}`);
      
      // Map error code to appropriate HTTP status
      const statusCode = ERROR_CODE_MAPPING[errorResponse.error_code] || HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;
      
      res.status(statusCode).json({
        success: false,
        message: errorResponse.message,
        error: errorResponse.error_code,
      timestamp: errorResponse.timestamp,
      });
      return;
    }

    // Handle legacy lighthouse_error format (backward compatibility)
    if (analysisData.lighthouse_error) {
      console.error("Legacy error from analyzer API:", analysisData.lighthouse_error);
      res.status(HTTP_STATUS_CODE.UNPROCESSABLE_ENTITY).json({
        success: false,
        message: "Performance analysis failed",
        error: "LIGHTHOUSE_ERROR",
        details: analysisData.lighthouse_error,
      });
      return;
    }
    
    // Process successful response
    const successData = analysisData as AnalyzerSuccessResponse;
    
    // Get screenshots from API response
    let desktopScreenshot = null;
    let mobileScreenshot = null;
    
    // Use base64 screenshots directly from API response
    if (successData.screenshots?.base64?.desktop) {
      // Add data URL prefix if not already present
      const desktopBase64 = successData.screenshots.base64.desktop;
      desktopScreenshot = desktopBase64.startsWith('data:') 
        ? desktopBase64 
        : `data:image/png;base64,${desktopBase64}`;
      console.log("Received desktop screenshot from API (base64 encoded)");
    }
    
    if (successData.screenshots?.base64?.mobile) {
      // Add data URL prefix if not already present
      const mobileBase64 = successData.screenshots.base64.mobile;
      mobileScreenshot = mobileBase64.startsWith('data:') 
        ? mobileBase64 
        : `data:image/png;base64,${mobileBase64}`;
      console.log("Received mobile screenshot from API (base64 encoded)");
    }
    
    // Fallback to reading from file system if paths are provided but base64 is not
    if (!desktopScreenshot && successData.screenshots?.paths?.desktop) {
      try {
        const desktopPath = successData.screenshots.paths.desktop;
        if (desktopPath && fs.existsSync(desktopPath)) {
          const desktopBase64 = fs.readFileSync(desktopPath).toString('base64');
          desktopScreenshot = `data:image/png;base64,${desktopBase64}`;
          console.log(`Read desktop screenshot from file: ${desktopPath}`);
        }
      } catch (fileError) {
        console.error("Error reading desktop screenshot file:", fileError);
      }
    }
    
    if (!mobileScreenshot && successData.screenshots?.paths?.mobile) {
      try {
        const mobilePath = successData.screenshots.paths.mobile;
        if (mobilePath && fs.existsSync(mobilePath)) {
          const mobileBase64 = fs.readFileSync(mobilePath).toString('base64');
          mobileScreenshot = `data:image/png;base64,${mobileBase64}`;
          console.log(`Read mobile screenshot from file: ${mobilePath}`);
        }
      } catch (fileError) {
        console.error("Error reading mobile screenshot file:", fileError);
      }
    }

    // Build final response object
    const analysisResults = {
      url: successData.url,
      timestamp: new Date().toISOString(),
      performanceScore: successData.lighthouse?.performanceScore || null,
      loadTime: successData.loadTime || null,
      issues: successData.issues || [],
      screenshots: {
        desktop: desktopScreenshot,
        mobile: mobileScreenshot,
      },
    };

    // If user has credits, deduct one credit
    const success = await req.services?.credits.deductCredits(userId as string, 1);

    if (!success) {
      res.status(HTTP_STATUS_CODE.PAYMENT_REQUIRED).json({
        success: false,
        message: "Could not deduct credits from your account. Please try again later.",
        error: "INSUFFICIENT_CREDITS",
      });
      return;
    }

    res.status(HTTP_STATUS_CODE.OK).json({
      success: true,
      message: "Website analysis completed",
      data: analysisResults,
    });
    
  } catch (error) {
    // Handle axios errors specifically
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      console.error(`Axios error: ${axiosError.message}`);
      
      if (axiosError.code === 'ECONNABORTED') {
        // Timeout error
        res.status(HTTP_STATUS_CODE.GATEWAY_TIMEOUT).json({
          success: false,
          message: "Analysis request timed out. The website may be too slow or unresponsive.",
          error: "TIMEOUT_ERROR",
        });
        return;
      }
      
      if (axiosError.response) {
        // Server responded with error status
        const statusCode = axiosError.response.status;
        const errorData = axiosError.response.data as any;
        
        console.error(`Analyzer API responded with status ${statusCode}:`, errorData);
        
        res.status(statusCode).json({
          success: false,
          message: errorData?.message || "Analysis service error",
          error: errorData?.error_code || "ANALYZER_ERROR",
          details: errorData?.details || null,
        });
        return;
      }
      
      if (axiosError.request) {
        // Network error - no response received
        console.error("Network error - no response from analyzer API");
        res.status(HTTP_STATUS_CODE.SERVICE_UNAVAILABLE).json({
          success: false,
          message: "Unable to connect to analysis service. Please try again later.",
          error: "SERVICE_UNAVAILABLE",
        });
        return;
      }
    }
    
    // Handle other errors
    console.error("Unexpected error in analyzeUIController:", error);
    res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
      error: "INTERNAL_ERROR",
    });
  }
};
