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
import axios from "axios";
import { NextFunction, Request, Response } from "express";
import fs from "fs";
import { HTTP_STATUS_CODE } from "../constants/constants";

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
    const apiKey = process.env.AGENT_API_KEY;
    
    if (!apiKey) {
      console.warn("ANALYZER_API_KEY not set in environment, API calls may fail if authentication is required");
    }
    
    console.log(`Making request to analyzer API at ${apiUrl} for URL: ${url}`);
    
    // Make request to the FastAPI analyzer service
    const response = await axios.post(
      `${apiUrl}/analyze`,
      { 
        url: url, 
        save_screenshots: true 
      },
      { 
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey || ''
        },
      }
    );
    
    // Process API response
    const analysisData = response.data;

    if (analysisData.lighthouse_error) {
      console.error("Error from analyzer API:", analysisData.lighthouse_error);
      res.status(HTTP_STATUS_CODE.OK).json({
        success: false,
        message: "Error analyzing website",
        error: analysisData.lighthouse_error,
      });
      return;
    }
    
    // Get screenshots from API response
    let desktopScreenshot = null;
    let mobileScreenshot = null;
    
    // Use base64 screenshots directly from API response
    if (analysisData.screenshots?.base64?.desktop) {
      // Add data URL prefix if not already present
      const desktopBase64 = analysisData.screenshots.base64.desktop;
      desktopScreenshot = desktopBase64.startsWith('data:') 
        ? desktopBase64 
        : `data:image/png;base64,${desktopBase64}`;
      console.log("Received desktop screenshot from API (base64 encoded)");
    }
    
    if (analysisData.screenshots?.base64?.mobile) {
      // Add data URL prefix if not already present
      const mobileBase64 = analysisData.screenshots.base64.mobile;
      mobileScreenshot = mobileBase64.startsWith('data:') 
        ? mobileBase64 
        : `data:image/png;base64,${mobileBase64}`;
      console.log("Received mobile screenshot from API (base64 encoded)");
    }
    
    // Fallback to reading from file system if paths are provided but base64 is not
    if (!desktopScreenshot && analysisData.screenshots?.paths?.desktop) {
      try {
        const desktopPath = analysisData.screenshots.paths.desktop;
        if (fs.existsSync(desktopPath)) {
          const desktopBase64 = fs.readFileSync(desktopPath).toString('base64');
          desktopScreenshot = `data:image/png;base64,${desktopBase64}`;
          console.log(`Read desktop screenshot from file: ${desktopPath}`);
        }
      } catch (fileError) {
        console.error("Error reading desktop screenshot file:", fileError);
      }
    }
    
    if (!mobileScreenshot && analysisData.screenshots?.paths?.mobile) {
      try {
        const mobilePath = analysisData.screenshots.paths.mobile;
        if (fs.existsSync(mobilePath)) {
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
      url: analysisData.url,
      timestamp: new Date().toISOString(),
      performanceScore: analysisData.lighthouse?.performanceScore || null,
      loadTime: analysisData.loadTime || null,
      issues: analysisData.issues || [],
      screenshots: {
        desktop: desktopScreenshot,
        mobile: mobileScreenshot,
      },
    };

    // If user has credits, deduct one credit
    const success = await req.services?.credits.deductCredits(userId as string, 1);

    if (!success) {
      res.status(HTTP_STATUS_CODE.PAYMENT_REQUIRED).json({
        error: "Failed to deduct credits",
        message: "Could not deduct credits from your account. Please try again later.",
      });
      return;
    }

    res.status(HTTP_STATUS_CODE.OK).json({
      success: true,
      message: "Website analysis completed",
      data: analysisResults,
    });
    
  } catch (error) {
    next(error);
  }
};
