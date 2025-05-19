import { Response } from "express";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { StatusCodes } from "http-status-codes";
import { User } from "../models/user.model";
import mongoose from "mongoose";
import Chat from "../models/chat.model";
import { ApiResponse } from "../utils/ApiResponse";
import { emitSocketEvent } from "../socket";
import { ChatEventEnum } from "../constants";
import Server from "../models/server.model";

//chatCommonAggregation
const chatCommonAggregation = () => {
  return [
    {
      //get participant details of the chat
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "participants",
        as: "participants",
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
      //get last message and its sender's details
      $lookup: {
        from: "messages",
        foreignField: "_id",
        localField: "lastMessage",
        as: "lastMessage",
        pipeline: [
          {
            //attach sender details
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
            //flatten it out
            $addFields: {
              sender: { $first: "$sender" },
            },
          },
        ],
      },
    },
    {
      //flatten out last message
      $addFields: {
        lastMessage: { $first: "$lastMessage" },
      },
    },
  ];
};

//createOnetoOneChat
export const createOrGetAOneOnOneChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    //check receiver and check that not same to sender
    const { receiverId } = req.params;
    if (!receiverId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Receiver Id not found");
    }

    const receiver = await User.findById(
      new mongoose.Types.ObjectId(receiverId)
    );
    if (!receiver) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Receiver not found");
    }

    if (receiver._id.toString() === req.user?._id.toString()) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Receiver and sender cannot be same"
      );
    }

    //check for already existing chat
    const chat = await Chat.aggregate([
      {
        $match: {
          isGroupChat: false,
          $and: [
            {
              participants: { $elemMatch: { $eq: req.user?._id } },
            },
            {
              participants: { $elemMatch: { $eq: receiver._id } },
            },
          ],
        },
      },
      ...chatCommonAggregation(),
    ]);

    if (chat.length) {
      return res
        .status(StatusCodes.OK)
        .json(
          new ApiResponse(StatusCodes.OK, "Chat retrieved succesfully", chat[0])
        );
    }

    //if not create new chat
    const newChatInstance = await Chat.create({
      name: "One On One Chat",
      isGroupChat: false,
      participants: [req.user?._id, receiver._id],
    });

    const createdChat = await Chat.aggregate([
      {
        $match: {
          _id: newChatInstance._id,
        },
      },
      ...chatCommonAggregation(),
    ]);

    const newChat = createdChat[0];
    if (!newChat) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Internal Server Error"
      );
    }

    //emit socket event
    newChatInstance.participants.forEach((participantObjectId) => {
      if (participantObjectId.toString() === req.user?._id.toString()) return;

      emitSocketEvent(
        req,
        participantObjectId.toString(),
        ChatEventEnum.NEW_CHAT_EVENT,
        newChat
      );
    });

    //response
    return res
      .status(StatusCodes.CREATED)
      .json(new ApiResponse(StatusCodes.CREATED, "New Chat Created", newChat));
  }
);

//createGroupChatInAServer
export const createGroupChatInAServer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { serverId } = req.params;
    const { name, participants } = req.body;

    //check for request body params
    if (!name || name.length < 1) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Provide Valid name for the group chat"
      );
    }
    if (!Array.isArray(participants)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Participants must be an array"
      );
    }

    //validate server
    const server = await Server.findById(new mongoose.Types.ObjectId(serverId));
    if (!server) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid Server id provided");
    }

    //check the user requesting is owner or admin of the server otherwise cannot
    const filteredMembers = server.members.filter(
      (member) => member.user.toString() === req.user?._id.toString()
    );
    if (filteredMembers.length === 0) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "USer is not a member of the server"
      );
    }
    if (
      filteredMembers[0].role !== "owner" &&
      filteredMembers[0].role !== "admin"
    ) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "User is not authorized to create a group"
      );
    }

    //participants array should not contain user and should have at least one other user
    if (participants.includes(req.user?._id.toString())) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "User cannot be in the participants list"
      );
    }
    if (participants.length < 1) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "There must be atleast one more participant to form a group chat"
      );
    }

    //create group and attach partcipants details
    const participantObjectIds = participants.map(
      (p: string) => new mongoose.Types.ObjectId(p)
    );

    const chatGroup = await Chat.create({
      name,
      isGroupChat: true,
      server: server._id,
      participants: [req.user?._id, ...participantObjectIds],
    });

    const chat = await Chat.aggregate([
      {
        $match: {
          _id: chatGroup._id,
        },
      },
      ...chatCommonAggregation(),
    ]);

    const newGroupChat = chat[0];
    if (!newGroupChat) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Internal Srever Error"
      );
    }

    //emit socket event
    chatGroup.participants.forEach((participantObjectId) => {
      if (participantObjectId.toString() === req.user?._id.toString()) return;

      emitSocketEvent(
        req,
        participantObjectId.toString(),
        ChatEventEnum.NEW_CHAT_EVENT,
        newGroupChat
      );
    });

    //response
    res
      .status(StatusCodes.CREATED)
      .json(
        new ApiResponse(
          StatusCodes.CREATED,
          "New Group Chat Created",
          newGroupChat
        )
      );
  }
);

//getAllOneToOneChats
export const getAllOneToOneChats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    //finding all chats that is not a group chat and has one of the participants as the requesting user
    const allChats = await Chat.aggregate([
      {
        $match: {
          isGroupChat: false,
          participants: {
            $elemMatch: { $eq: new mongoose.Types.ObjectId(req.user?._id) },
          },
        },
      },
      ...chatCommonAggregation(),
    ]);

    return res
      .status(StatusCodes.OK)
      .json(new ApiResponse(StatusCodes.OK, "All chats are fetched", allChats));
  }
);

//getAllGroupChatsInAServer
export const getAllGroupChatsInAServer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { serverId } = req.params;
    const server = await Server.findById(new mongoose.Types.ObjectId(serverId));
    if (!server) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "No server found. Invalid Server id"
      );
    }

    const allChats = await Chat.aggregate([
      {
        $match: {
          isGroupChat: true,
          server: new mongoose.Types.ObjectId(serverId),
          participants: {
            $elemMatch: { $eq: new mongoose.Types.ObjectId(req.user?._id) },
          },
        },
      },
      ...chatCommonAggregation(),
    ]);

    return res
      .status(StatusCodes.OK)
      .json(new ApiResponse(StatusCodes.OK, "All Chats retrived", allChats));
  }
);
