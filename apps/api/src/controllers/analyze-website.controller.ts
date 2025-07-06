/**
 * Controller for the website UI analysis endpoint
 *
 * This controller executes the Python-based website analyzer located in /apps/agent/analyzer.py
 * It handles both the HTTP response to the client and the asynchronous execution of the analyzer
 *
 * The analyzer performs:
 * 1. Website screenshot capture using Playwright
 * 2. Performance analysis using Lighthouse
 * 3. AI-based UI analysis using vision models
 */
import { spawn } from "child_process";
import { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { HTTP_STATUS_CODE } from "../constants/constants";

export const analyzeUIController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { url } = req.body;
  const userId = req.userId;

  try {
    // Path to the Python analyzer script
    const agentPath = path.join(__dirname, "../../../agent");

    // Check if the Python script exists
    const analyzerPath = path.join(agentPath, "analyzer.py");
    if (!fs.existsSync(analyzerPath)) {
      res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Analyzer script not found",
        error: `Could not find ${analyzerPath}`,
      });
    }

    // Check if the virtual environment exists
    const venvPath = path.join(agentPath, ".venv");
    const usePythonVenv = fs.existsSync(venvPath);

    // Execute the Python analyzer script
    const args = ["analyzer.py", url, "--save-screenshots"];

    // Determine how to run Python based on environment
    let pythonProcess;

    if (usePythonVenv) {
      // Use the run.sh script if available
      if (fs.existsSync(path.join(agentPath, "run.sh"))) {
        console.log(`Running analyzer with run.sh script`);
        const shellArgs = [url];
        shellArgs.push("--save-screenshots");

        pythonProcess = spawn("./run.sh", shellArgs, {
          cwd: agentPath,
          env: { ...process.env, PYTHONUNBUFFERED: "1" },
          shell: true,
        });
      } else {
        // For macOS/Linux
        const activateCmd = `source ${path.join(venvPath, "bin/activate")} && python ${args.join(" ")}`;
        pythonProcess = spawn(activateCmd, [], {
          cwd: agentPath,
          env: { ...process.env, PYTHONUNBUFFERED: "1" },
          shell: true,
        });
      }
    } else {
      // Use system Python
      pythonProcess = spawn("python", args, {
        cwd: agentPath,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });
    }

    let stdoutData = "";
    let stderrData = "";

    pythonProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();
      console.log(`[Analyzer] ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      stderrData += data.toString();
      console.error(`[Analyzer Error] ${data.toString().trim()}`);
    });

    // Process is complete - results would be saved for later retrieval
    pythonProcess.on("close", async (code) => {
      if (code !== 0) {
        console.error(`Analysis process exited with code ${code}`);
        console.error(stderrData);
        // Here you would typically store the error in a database or log system
        return;
      }

      try {
        // Parse performance metrics if available
        const lighthouseMatch = stdoutData.match(
          /Performance Score: (\d+\.?\d*)\/100/
        );
        const loadTimeMatch = stdoutData.match(
          /Load Time: (\d+\.?\d*) seconds/
        );

        const desktopScreenshotMatch = stdoutData.match(
          /Desktop screenshot: (.+)/
        );

        const mobileScreenshotMatch = stdoutData.match(
          /Mobile screenshot: (.+)/
        );

        // Read screenshots if available.
        const desktopScreenshotPath = desktopScreenshotMatch
          ? path.join(desktopScreenshotMatch[1].trim())
          : null;

        const mobileScreenshotPath = mobileScreenshotMatch
          ? path.join(mobileScreenshotMatch[1].trim())
          : null;
        
       // Read files to ensure they exist and get the image data
       let desktopScreenshot = null;
       let mobileScreenshot = null;
       
       try {
         if (desktopScreenshotPath && fs.existsSync(desktopScreenshotPath)) {
           desktopScreenshot = fs.readFileSync(desktopScreenshotPath).toString('base64');
           console.log(`Read desktop screenshot: ${desktopScreenshotPath}`);
         }
         
         if (mobileScreenshotPath && fs.existsSync(mobileScreenshotPath)) {
           mobileScreenshot = fs.readFileSync(mobileScreenshotPath).toString('base64');
           console.log(`Read mobile screenshot: ${mobileScreenshotPath}`);
         }
       } catch (fileError) {
         console.error("Error reading screenshot files:", fileError);
       } 

        // Parse issues found
        const issuesSection = stdoutData.split("ISSUES FOUND:")[1];
        const issuesList = issuesSection
          ? issuesSection
              .split("\n")
              .filter((line) => line.trim().startsWith("•"))
              .map((line) => line.trim().substring(2).trim())
          : [];

        // Save results - in a production app, you'd store this in a database
        const analysisResults = {
          url,
          timestamp: new Date().toISOString(),
          performanceScore: lighthouseMatch
            ? parseFloat(lighthouseMatch[1])
            : null,
          loadTime: loadTimeMatch ? parseFloat(loadTimeMatch[1]) : null,
          issues: issuesList,
          rawOutput: stdoutData,
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
            message:
              "Could not deduct credits from your account. Please try again later.",
          });
          return;
        }

        // In a real app, you'd save this to a database
        return res.status(HTTP_STATUS_CODE.OK).json({
          success: true,
          message: "Website analysis completed",
          data: analysisResults,
        });
      } catch (parseError) {
        return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: "Failed to parse analysis results",
          error: (parseError as Error).message,
        });
      }
    });
  } catch (error) {
    next(error);
  }
};
