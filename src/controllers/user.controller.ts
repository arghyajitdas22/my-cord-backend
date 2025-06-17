import { Request, Response } from "express-serve-static-core";
import { User } from "../models/user.model";
import { asyncHandler } from "../utils/asyncHandler";
import { StatusCodes } from "http-status-codes";
import { ApiResponse } from "../utils/ApiResponse";
import { IUser, TSearchUsersQuery } from "../types/User";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { ApiError } from "../utils/ApiError";
import FriendRequest from "../models/request.model";
import { FriendRequestStatus } from "../types/friendRequest.type";
import { emitSocketEvent } from "../socket";
import { ChatEventEnum } from "../constants";
import mongoose, { HydratedDocument } from "mongoose";
import { createOrGetOneOnOneChat } from "../services/chat.service";

export const searchUsers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const search = req.query.search?.toString().trim() || "";
    const page = parseInt(req.query.page?.toString() || "1");
    const limit = parseInt(req.query.limit?.toString() || "5");
    const skip = (page - 1) * limit;

    const query: any = {
      _id: { $ne: req.user?._id },
    };

    if (search.length > 0) {
      query.username = {
        $regex: search,
        $options: "i",
      };
    }
    const users = await User.find(query)
      .select("_id email username displayName")
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
  }
);

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

    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId),
    ]);

    if (!sender || !receiver) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    if (
      sender.friends.some((id) => id.toString() === receiverId.toString()) ||
      receiver.friends.some((id) => id.toString() === senderId.toString())
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

    const reverseRequest = await FriendRequest.findOne({
      sender: receiverId,
      receiver: senderId,
    });
    if (reverseRequest) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Receiver has already sent you a friend request"
      );
    }

    const friendRequest = await FriendRequest.create({
      sender: sender._id,
      receiver: receiver._id,
    });

    await Promise.all([
      User.updateOne(
        { _id: senderId },
        { $push: { sentRequests: friendRequest._id } },
        { runValidators: false }
      ),
      User.updateOne(
        { _id: receiverId },
        { $push: { receivedRequests: friendRequest._id } },
        { runValidators: false }
      ),
    ]);

    const populatedFriendRequest = await FriendRequest.aggregate([
      {
        $match: {
          _id: friendRequest._id,
        },
      },
      {
        $lookup: {
          from: "users",
          foreignField: "_id",
          localField: "sender",
          as: "sender",
          pipeline: [
            {
              $project: {
                password: 0,
                refreshToken: 0,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          sender: {
            $first: "$sender",
          },
        },
      },
    ]);

    emitSocketEvent(
      req,
      receiver._id.toString(),
      ChatEventEnum.FRIEND_REQUEST_SENT_EVENT,
      populatedFriendRequest[0]
    );

    return res
      .status(StatusCodes.CREATED)
      .json(
        new ApiResponse(
          StatusCodes.CREATED,
          "Friend request sent",
          populatedFriendRequest[0]
        )
      );
  }
);

export const updateFriendRequestStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.params.requestId;
    const status = req.body.status;

    // Validate input
    if (!requestId || !status) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid request");
    }

    if (!Object.values(FriendRequestStatus).includes(status)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid request status");
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Fetch the friend request
      const friendRequest =
        await FriendRequest.findById(requestId).session(session);
      if (!friendRequest) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Request not found");
      }

      // Authorization check
      if (friendRequest.receiver.toString() !== req.user?._id.toString()) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          "You are not authorized to update this request"
        );
      }

      // Fetch sender and receiver
      const sender = await User.findById(friendRequest.sender).session(session);
      const receiver = await User.findById(friendRequest.receiver).session(
        session
      );

      if (!sender || !receiver) {
        throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
      }

      // Remove the request from both users
      sender.sentRequests = sender.sentRequests.filter(
        (reqId) => reqId.toString() !== requestId
      );
      receiver.receivedRequests = receiver.receivedRequests.filter(
        (reqId) => reqId.toString() !== requestId
      );

      let response: any = {};
      // If accepted, add each other as friends (without duplication)
      if (status === FriendRequestStatus.ACCEPTED) {
        if (!sender.friends.includes(receiver._id)) {
          sender.friends.push(receiver._id);
        }

        if (!receiver.friends.includes(sender._id)) {
          receiver.friends.push(sender._id);
        }

        response = await createOrGetOneOnOneChat(sender._id, receiver._id);

        if (!response) {
          throw new ApiError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            "Failed to create or get one-on-one chat"
          );
        }

        // Emit socket event
        response.participants.forEach(
          (participant: HydratedDocument<IUser>) => {
            if (participant._id.toString() !== req.user?._id.toString()) {
              emitSocketEvent(
                req,
                participant._id.toString(),
                ChatEventEnum.NEW_CHAT_EVENT,
                response
              );
            }
          }
        );
      }

      // Save updates
      await sender.save({ validateBeforeSave: false, session });
      await receiver.save({ validateBeforeSave: false, session });

      // Delete the request
      await FriendRequest.findByIdAndDelete(requestId).session(session);

      await session.commitTransaction();

      return res
        .status(StatusCodes.OK)
        .json(new ApiResponse(StatusCodes.OK, "Request updated", response));
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
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

export const getAllInvitations = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const inviations = await FriendRequest.aggregate([
      {
        $match: {
          receiver: new mongoose.Types.ObjectId(req.user?._id),
          status: FriendRequestStatus.PENDING,
        },
      },
      {
        $lookup: {
          from: "users",
          foreignField: "_id",
          localField: "sender",
          as: "sender",
          pipeline: [
            {
              $project: {
                password: 0,
                refreshToken: 0,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          sender: {
            $first: "$sender",
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    return res
      .status(StatusCodes.OK)
      .json(
        new ApiResponse(
          StatusCodes.OK,
          "All inviations are fetched",
          inviations
        )
      );
  }
);
