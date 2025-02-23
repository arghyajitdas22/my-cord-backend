import { Request, Response, NextFunction } from "express-serve-static-core";
import { ApiError } from "../utils/ApiError";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";

const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err as ApiError;

  if (!(error instanceof ApiError)) {
    const statusCode =
      (error as any) instanceof mongoose.Error
        ? StatusCodes.BAD_REQUEST
        : StatusCodes.INTERNAL_SERVER_ERROR;
    const message = (error as Error).message || "Something went wrong";
    error = new ApiError(
      statusCode,
      message,
      (error as any)?.errors || [],
      (error as Error).stack
    );
  }

  const response = {
    message: error.message,
    statusCode: error.statusCode,
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  res
    .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
    .json(response);
};

export { errorHandler };
