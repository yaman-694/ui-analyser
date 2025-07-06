import { Router } from "express";
import verifyClerkAuth from "../middleware/auth.middleware";
import checkCredits from "../middleware/check-credits.middleware";
import { errorHandler } from "../middleware/error.middleware";
import refreshCredits from "../middleware/refresh-credits.middleware";
import { attachServices } from "../middleware/services.middleware";
import { validateSchema } from "../validators/validate-schema";
import { urlSchema } from "../validators/validators";
import { analyzeUIController } from "../controllers/analyze-website";

const aiRouter = Router();

/**
 * POST /generate-comment
 * Generates an AI-powered LinkedIn comment based on a provided post
 */
aiRouter.post(
  "/analyze-ui",
  validateSchema(urlSchema),
  verifyClerkAuth,
  attachServices,
  refreshCredits,
  checkCredits,
  analyzeUIController,
  errorHandler
);

export default aiRouter;
