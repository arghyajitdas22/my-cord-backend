import { Request, Response } from "express-serve-static-core";
import { StatusCodes } from "http-status-codes";
import { User } from "../models/user.model";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { registerUserSchema } from "../validators/user.validator";

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

export { registerUser };
