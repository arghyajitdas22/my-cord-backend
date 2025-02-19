import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { Request, Response } from "express-serve-static-core";
import { StatusCodes } from "http-status-codes";

export const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  return res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse<string>(
        StatusCodes.OK,
        "Success",
        "Healthcheck successful"
      )
    );
});
