import { StatusCodes } from "http-status-codes";
import { chatCommonAggregation } from "../controllers/chat.controller";
import Chat from "../models/chat.model";
import { ApiError } from "../utils/ApiError";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import {} from "../validators/chat.validator";

export const createOrGetOneOnOneChat = async (
  userId: Types.ObjectId,
  receiverId: Types.ObjectId
) => {
  if (userId.toString() === receiverId.toString()) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Cannot chat with yourself");
  }

  const receiver = await User.findById(receiverId);
  if (!receiver) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Receiver not found");
  }

  const existingChat = await Chat.aggregate([
    {
      $match: {
        isGroupChat: false,
        $and: [
          { participants: { $elemMatch: { $eq: userId } } },
          { participants: { $elemMatch: { $eq: receiverId } } },
        ],
      },
    },
    ...chatCommonAggregation(),
  ]);

  if (existingChat.length > 0) {
    return existingChat[0];
  }

  const newChatInstance = await Chat.create({
    name: "One On One Chat",
    isGroupChat: false,
    participants: [userId, receiverId],
  });

  const createdChat = await Chat.aggregate([
    { $match: { _id: newChatInstance._id } },
    ...chatCommonAggregation(),
  ]);

  return createdChat[0];
};
