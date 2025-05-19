import { StatusCodes } from "http-status-codes";
import Chat from "../models/chat.model";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import Message from "../models/message.model";
import mongoose from "mongoose";
import { ApiResponse } from "../utils/ApiResponse";
import { Response } from "express";
import { uploadOnCloudianry } from "../utils/cloudinary";
import { emitSocketEvent } from "../socket";
import { ChatEventEnum } from "../constants";

const chatMessageCommonAggregation = () => {
  return [
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "sender",
        as: "sender",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              // profilePicture: 1
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
  ];
};

export const getAllMessages = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { chatId } = req.params;
    const selectedChat = await Chat.findById(chatId);

    if (!selectedChat) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Chat not found");
    }

    if (req.user && !selectedChat.participants.includes(req.user?._id)) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You are not a participant of this chat"
      );
    }

    const messages = await Message.aggregate([
      {
        $match: {
          chat: new mongoose.Types.ObjectId(chatId),
        },
      },
      ...chatMessageCommonAggregation(),
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);

    return res
      .status(StatusCodes.OK)
      .json(
        new ApiResponse(
          StatusCodes.OK,
          "Messages fetched successfully",
          messages || []
        )
      );
  }
);

export const sendMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { chatId } = req.params;
    const { content } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!content && !files?.length) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "content aur attachments must be sent"
      );
    }

    const selectedChat = await Chat.findById(chatId);

    if (!selectedChat) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Chat not found");
    }

    if (req.user && !selectedChat.participants.includes(req.user?._id)) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You are not a participant of this chat"
      );
    }

    const attachments: String[] = [];

    if (files && files.length > 0) {
      files.map(async (file) => {
        const localPath = file.path;
        const url = await uploadOnCloudianry(localPath);
        if (url) {
          attachments.push(url);
        }
      });
    }

    const message = await Chat.create({
      sender: new mongoose.Types.ObjectId(req.user?._id),
      content: content || "",
      chat: new mongoose.Types.ObjectId(chatId),
      attachments,
    });

    const chat = await Chat.findByIdAndUpdate(
      chatId,
      {
        $set: {
          lastMessage: message._id,
        },
      },
      {
        new: true,
      }
    );

    if (!chat) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Chat not found");
    }

    const messages = await Message.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(message._id),
        },
      },
      ...chatMessageCommonAggregation(),
    ]);

    const receivedMessage = messages[0];

    if (!receivedMessage) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Internal Server Error"
      );
    }

    chat?.participants.forEach((participantObjectId) => {
      if (participantObjectId.toString() === req.user?._id.toString()) return;

      emitSocketEvent(
        req,
        participantObjectId.toString(),
        ChatEventEnum.MESSAGE_RECEIVED_EVENT,
        receivedMessage
      );
    });

    res
      .status(StatusCodes.CREATED)
      .json(
        new ApiResponse(StatusCodes.CREATED, "message sent", receivedMessage)
      );
  }
);

export const deleteAndUpdateMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { chatId, messageId } = req.params;
    const { content } = req.body;

    //find the chat and error check
    const selectedChat = await Chat.findOne({
      _id: new mongoose.Types.ObjectId(chatId),
      participants: req.user?._id,
    });

    if (!selectedChat) {
      throw new ApiError(StatusCodes.BAD_GATEWAY, "Chat not found");
    }

    //find the message and update isDeleted as true also isEdited based on condition
    const selectedMessage = await Message.findOne({
      _id: new mongoose.Types.ObjectId(messageId),
    });

    if (!selectedMessage) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "No such message found");
    }

    if (selectedMessage.sender.toString() !== req.user?._id.toString()) {
      throw new ApiError(StatusCodes.FORBIDDEN, "You cannot delete this chat");
    }

    const message = await Message.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(messageId),
      },
      {
        $set: {
          isDeleted: true,
          isEdited: content && content.length > 0 ? true : false,
        },
      },
      { new: true }
    );

    //broadcast it to every participant in the chat

    selectedChat.participants.forEach((participantObjectId) => {
      if (participantObjectId.toString() === req.user?._id.toString()) return;

      emitSocketEvent(
        req,
        participantObjectId.toString(),
        ChatEventEnum.MESSAGE_DELETE_EVENT,
        message
      );
    });

    return res
      .status(StatusCodes.OK)
      .json(new ApiResponse(StatusCodes.OK, "Message updated", message));
  }
);
