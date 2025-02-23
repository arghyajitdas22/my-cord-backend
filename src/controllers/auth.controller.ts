import { Request, Response } from "express-serve-static-core";
import { StatusCodes } from "http-status-codes";
import { User } from "../models/user.model";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

const registerUser = asyncHandler((req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ msg: "Register user" });
});

export { registerUser };
