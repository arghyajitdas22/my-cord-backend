import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { StatusCodes } from "http-status-codes";
import { User } from "../models/user.model";
import { Response, NextFunction } from "express-serve-static-core";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";

const verifyAccessToken = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const accessToken =
        req.cookies?.accessToken || req.header("Authorization")?.split(" ")[1];
      if (!accessToken) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          "Access token is required"
        );
      }
      const decodedAccessToken = jwt.verify(
        accessToken,
        process.env.ACCESS_TOKEN_SECRET as string
      );
      const user = await User.findById((decodedAccessToken as any).userId);
      if (!user) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid token");
      }
      req.user = user;
      next();
    } catch (error) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid token");
    }
  }
);

export { verifyAccessToken };
