import { Router } from "express";
import verifyClerkAuth from "../middleware/auth.middleware";
import { errorHandler } from "../middleware/error.middleware";
import { getCurrentUserController } from "../controllers/user.controller";

const userRouter = Router();

/**
 * POST /generate-comment
 * Generates an AI-powered LinkedIn comment based on a provided post
 */
userRouter.get(
  "/get-current-user",
  verifyClerkAuth,
  getCurrentUserController,
  errorHandler
);

export default userRouter;
