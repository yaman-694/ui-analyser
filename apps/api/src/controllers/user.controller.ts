import { NextFunction, Request, Response } from "express";
import { HTTP_STATUS_CODE } from "../constants/constants";
import User from "../model/user.model";

export const getCurrentUserController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findOne({ clerkId: req.userId });

    const credits = await req.services?.credits.getCredits(req.userId || "");

    if (!user) {
      res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(HTTP_STATUS_CODE.ACCEPTED).json({
      success: true,
      data: {
        ...user,
        credits
      },
    });
  } catch (error) {
    next(error);
  }
};
