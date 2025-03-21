import { Request, Response } from "express-serve-static-core";
import { User } from "../models/user.model";
import { asyncHandler } from "../utils/asyncHandler";
import { StatusCodes } from "http-status-codes";
import { ApiResponse } from "../utils/ApiResponse";
import { TSearchUsersQuery } from "../types/User";

export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
  const search = req.query.search?.toString().trim() || "";
  const page = parseInt(req.query.page?.toString() || "1");
  const limit = parseInt(req.query.limit?.toString() || "5");
  const skip = (page - 1) * limit;

  let query = {};
  if (search.length > 0) {
    query = {
      username: {
        $regex: search,
        $options: "i",
      },
    };
  }
  const users = await User.find(query)
    .select("_id username displayName")
    .skip(skip)
    .limit(limit);
  const totalUsers = await User.countDocuments(query);

  res.status(StatusCodes.OK).json(
    new ApiResponse<TSearchUsersQuery>(StatusCodes.OK, "Users found", {
      users,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
    })
  );
});
