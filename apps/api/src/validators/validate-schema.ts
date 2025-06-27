import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError } from "zod";
import { HTTP_STATUS_CODE } from "../constants/constants";
import { ApiResponse } from "../types";

/**
 * Middleware to validate the request body, params, or query using a Zod schema.
 *
 * @param {AnyZodObject} schema - The Zod schema to validate against.
 * @param {string} type - The part of the request to validate ('body', 'params', or 'query').
 * @returns {Function} Middleware function to validate the request.
 */
export const validateSchema = (
  schema: AnyZodObject, 
  type: 'body' | 'params' | 'query' = 'body'
) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		try {
			const parsedData = schema.parse(req[type]);
			req[type] = {
				...req[type],
				...parsedData
			};
			next();
		} catch (error) {
			if (error instanceof ZodError) {
				const errorResponse: ApiResponse<null> = {
					success: false,
					message: 'Validation failed',
					errors: error.errors.map(err => ({
						path: err.path.join('.'),
						message: err.message,
					})),
				};
				
				res.status(HTTP_STATUS_CODE.BAD_REQUEST).json(errorResponse);
				return;
			}
			
			res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
				success: false,
				message: 'Invalid request data'
			});
			return;
		}
	};
};
