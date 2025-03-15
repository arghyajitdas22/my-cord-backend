import { Request, Response } from "express-serve-static-core";
import { StatusCodes } from "http-status-codes";
import { User } from "../models/user.model";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import {
  loginUserSchema,
  registerUserSchema,
} from "../validators/user.validator";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";

const accessTokenOptions = {
  httpOnly: true,
  secure: true,
};

const refreshTokenOptions = {
  httpOnly: true,
  secure: true,
  path: "/api/v1/auth/refresh-token",
};

const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const receivedUser = req.body;
  const validatedUser = registerUserSchema.parse(receivedUser);
  const existedUser = await User.findOne({
    $or: [{ email: validatedUser.email }, { username: validatedUser.username }],
  });
  if (existedUser) {
    throw new ApiError(StatusCodes.CONFLICT, "User already exists");
  }
  const user = await User.create(validatedUser);
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  return res
    .status(StatusCodes.OK)
    .cookie("accessToken", accessToken, accessTokenOptions)
    .cookie("refreshToken", refreshToken, refreshTokenOptions)
    .json(
      new ApiResponse(StatusCodes.CREATED, "User has been registered", {
        user: createdUser,
        accessToken,
      })
    );
});

const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const receivedUser = req.body;
  const validatedUser = loginUserSchema.parse(receivedUser);
  const user = await User.findOne({ email: validatedUser.email });
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User not found");
  }
  const isPasswordCorect = await user.comparePassword(validatedUser.password);
  if (!isPasswordCorect) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Incorrect password");
  }
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  const updatedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  return res
    .status(StatusCodes.OK)
    .cookie("accessToken", accessToken, accessTokenOptions)
    .cookie("refreshToken", refreshToken, refreshTokenOptions)
    .json(
      new ApiResponse(StatusCodes.OK, "User has been logged in", {
        user: updatedUser,
        accessToken,
      })
    );
});

const refreshTokens = asyncHandler(async (req: Request, res: Response) => {
  const incomingrefreshToken = req.cookies.refreshToken;
  if (!incomingrefreshToken) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Refresh token is missing");
  }

  try {
    const deodedRefreshToken = jwt.verify(
      incomingrefreshToken,
      process.env.REFRESH_TOKEN_SECRET as string
    );
    const user = await User.findById((deodedRefreshToken as any).userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }
    if (user.refreshToken !== incomingrefreshToken) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Refresh Token Expired");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );
    return res
      .status(StatusCodes.OK)
      .cookie("accessToken", accessToken, accessTokenOptions)
      .cookie("refreshToken", refreshToken, refreshTokenOptions)
      .json(
        new ApiResponse(StatusCodes.OK, "Tokens have been refreshed", {
          user: loggedInUser,
          accessToken,
        })
      );
  } catch (error) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid refresh token");
  }
});

const logoutUSer = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.body.userId;
  if (!userId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User Id missing");
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user id");
  }
  user.refreshToken = "";
  await user.save({ validateBeforeSave: false });
  return res
    .clearCookie("accessToken", accessTokenOptions)
    .clearCookie("refreshToken", refreshTokenOptions)
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "User successfully logged out", {}));
});

export { registerUser, loginUser, refreshTokens, logoutUSer };
