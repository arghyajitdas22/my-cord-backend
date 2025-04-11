import Server from "../models/server.model";
import { User } from "../models/user.model";
import { Response } from "express-serve-static-core";
import { asyncHandler } from "../utils/asyncHandler";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "../utils/ApiError";
import { uploadOnCloudianry } from "../utils/cloudinary";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { createServerSchema } from "../validators/server.validator";
import { ApiResponse } from "../utils/ApiResponse";

export const createServer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const file = req.file as Express.Multer.File;
    const avatarLocalFilePath = file?.path;
    if (!avatarLocalFilePath) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Please provide an avatar");
    }

    const avatar = await uploadOnCloudianry(avatarLocalFilePath);
    const owner = req.user?._id;
    const name = req.body.name?.trim();

    const validatedServer = createServerSchema.parse({
      owner,
      name,
      avatar,
    });

    const server = await Server.create(validatedServer);
    if (!server) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Server not created");
    }

    server.save({ validateBeforeSave: false });

    res
      .status(StatusCodes.CREATED)
      .json(
        new ApiResponse(StatusCodes.CREATED, "Server has been created", {
          server,
        })
      );
  }
);
