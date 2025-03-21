import { Request, Response } from "express-serve-static-core";
import { User } from "../models/user.model";
import { asyncHandler } from "../utils/asyncHandler";
import { StatusCodes } from "http-status-codes";
import { ApiResponse } from "../utils/ApiResponse";
import { TSearchUsersQuery } from "../types/User";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { ApiError } from "../utils/ApiError";
import FriendRequest from "../models/request.model";

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

export const sendFriendRequest = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const senderId = req.user?._id;
    const receiverId = req.params.receiverId;

    if (!senderId || !receiverId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid request");
    }

    if (senderId?.toString() === receiverId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "You cannot send a friend request to yourself"
      );
    }

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    if (
      sender.friends.includes(receiverId as any) ||
      receiver.friends.includes(senderId as any)
    ) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "You are already friends");
    }

    const existingRequest = await FriendRequest.findOne({
      sender: senderId,
      receiver: receiverId,
    });

    if (existingRequest) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Friend request already sent"
      );
    }

    const friendRequest = new FriendRequest({
      sender: senderId,
      receiver: receiverId,
    });

    sender.sentRequests.push(friendRequest._id);
    receiver.receivedRequests.push(friendRequest._id);

    await friendRequest.save();
    await sender.save({ validateBeforeSave: false });
    await receiver.save({ validateBeforeSave: false });

    return res
      .status(StatusCodes.CREATED)
      .json(
        new ApiResponse(
          StatusCodes.CREATED,
          "Friend request sent",
          friendRequest
        )
      );
  }
);
