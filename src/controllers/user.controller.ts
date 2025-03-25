import { Request, Response } from "express-serve-static-core";
import { User } from "../models/user.model";
import { asyncHandler } from "../utils/asyncHandler";
import { StatusCodes } from "http-status-codes";
import { ApiResponse } from "../utils/ApiResponse";
import { TSearchUsersQuery } from "../types/User";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { ApiError } from "../utils/ApiError";
import FriendRequest from "../models/request.model";
import { FriendRequestStatus } from "../types/friendRequest.type";

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

export const updateFriendRequestStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.params.requestId;
    const status = req.body.status;

    if (!requestId || !status) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid request");
    }

    const request = await FriendRequest.findById(requestId);

    if (!request) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Request not found");
    }

    if (request.receiver.toString() !== req.user?._id.toString()) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You are not authorized to update this request"
      );
    }

    const sender = await User.findById(request.sender);
    const receiver = await User.findById(request.receiver);

    if (!sender || !receiver) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    sender.sentRequests = sender.sentRequests.filter(
      (reqId) => reqId.toString() !== requestId
    );
    receiver.receivedRequests = receiver.receivedRequests.filter(
      (reqId) => reqId.toString() !== requestId
    );

    if (status === FriendRequestStatus.ACCEPTED) {
      sender.friends.push(receiver._id);
      receiver.friends.push(sender._id);
    }
    await sender.save({ validateBeforeSave: false });
    await receiver.save({ validateBeforeSave: false });

    await FriendRequest.findByIdAndDelete(requestId);

    res
      .status(StatusCodes.OK)
      .json(new ApiResponse(StatusCodes.OK, "Request updated", {}));
  }
);

export const getAllFriends = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?._id;

    if (!userId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid request");
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    const friends = await User.find({
      _id: { $in: user.friends },
    }).select("_id username displayName");

    res
      .status(StatusCodes.OK)
      .json(new ApiResponse(StatusCodes.OK, "Friends found", friends));
  }
);
