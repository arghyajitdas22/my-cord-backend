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
  return res.status(StatusCodes.OK).json(
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
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  const isPasswordCorect = await user.comparePassword(validatedUser.password);
  if (!isPasswordCorect) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Incorrect password");
  }
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  const updatedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  return res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "User has been logged in", {
      user: updatedUser,
      accessToken,
    })
  );
});

export { registerUser, loginUser };
