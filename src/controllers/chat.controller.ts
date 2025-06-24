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
import { createOrGetOneOnOneChat } from "../services/chat.service";
import { IUser } from "../types/User";
import { HydratedDocument } from "mongoose";

//chatCommonAggregation
export const chatCommonAggregation = () => {
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

    if (!req.user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User not logged in");
    }

    const newChat = await createOrGetOneOnOneChat(
      req.user?._id,
      new mongoose.Types.ObjectId(receiverId)
    );
    if (!newChat) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Internal Server Error"
      );
    }

    //emit socket event
    newChat.participants.forEach((participant: HydratedDocument<IUser>) => {
      if (participant._id.toString() === req.user?._id.toString()) return;

      emitSocketEvent(
        req,
        participant._id.toString(),
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
      {
        $sort: {
          "lastMessage.createdAt": -1,
          createdAt: -1,
        },
      },
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
      {
        $sort: {
          "lastMessage.createdAt": -1,
          createdAt: -1,
        },
      },
    ]);

    return res
      .status(StatusCodes.OK)
      .json(new ApiResponse(StatusCodes.OK, "All Chats retrived", allChats));
  }
);

//getGroupChatDetails
export const getGroupChatDetails = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { serverId, chatId } = req.params;
    //check if such a chat exists
    const requestedChat = await Chat.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(chatId),
          server: new mongoose.Types.ObjectId(serverId),
          isGroupChat: true,
        },
      },
      ...chatCommonAggregation(),
    ]);
    //return error or respesonse
    if (!requestedChat.length) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "No such chat found");
    }

    return res
      .status(StatusCodes.OK)
      .json(
        new ApiResponse(
          StatusCodes.OK,
          "Chat details retrived",
          requestedChat[0]
        )
      );
  }
);

//renameGroupChat
export const renameGroupChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { serverId, chatId } = req.params;
    const { newGroupName } = req.body;

    if (!newGroupName || newGroupName.trim().length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid group name");
    }

    //find server and check if req.user is a owner or admin in the server
    const server = await Server.findById(new mongoose.Types.ObjectId(serverId));
    if (!server) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid server id");
    }
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
        "User is not authorized make updates in group name"
      );
    }

    //find chat by id and update
    const updatedChat = await Chat.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(chatId),
        server: new mongoose.Types.ObjectId(serverId),
        isGroupChat: true,
      },
      {
        name: newGroupName,
      },
      {
        new: true,
      }
    );

    if (!updatedChat) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid chat id");
    }

    //emit socket
    updatedChat.participants.forEach((participanyObjectId) => {
      if (participanyObjectId.toString() === req.user?._id.toString()) return;

      emitSocketEvent(
        req,
        participanyObjectId.toString(),
        ChatEventEnum.UPDATE_GROUP_NAME_EVENT,
        updatedChat
      );
    });

    return res
      .status(StatusCodes.OK)
      .json(
        new ApiResponse(StatusCodes.OK, "Group Chat Name Changed", updatedChat)
      );
  }
);

//deleteGroupChat
export const deleteGroupChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { serverId, chatId } = req.params;

    //find server and check if req.user is a owner or admin in the server
    const server = await Server.findById(new mongoose.Types.ObjectId(serverId));
    if (!server) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid server id");
    }
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
        "User is not authorized to delete a group"
      );
    }

    //find chat and delete
    const chat = await Chat.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(chatId),
      server: new mongoose.Types.ObjectId(serverId),
      isGroupChat: true,
    });

    if (!chat) {
      throw new ApiError(StatusCodes.NOT_FOUND, "No such chat found");
    }

    chat.participants.forEach((participantObjectId) => {
      if (participantObjectId.toString() === req.user?._id.toString()) return;

      emitSocketEvent(
        req,
        participantObjectId.toString(),
        ChatEventEnum.LEAVE_CHAT_EVENT,
        chat
      );
    });

    return res
      .status(StatusCodes.OK)
      .json(
        new ApiResponse(StatusCodes.OK, "Group chat deleted successfully", chat)
      );
  }
);

//leaveGroupChat
export const leaveGroupChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { serverId, chatId } = req.params;

    //find chat and see if user is participant
    const chat = await Chat.findOne({
      _id: new mongoose.Types.ObjectId(chatId),
      server: new mongoose.Types.ObjectId(serverId),
      isGroupChat: true,
    });

    if (!chat) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid server or chat id");
    }

    if (
      req.user &&
      !chat.participants.some((participant) =>
        participant.equals(req.user?._id)
      )
    ) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You are not a part of the chat group"
      );
    }

    //filter out the other participants
    const updatedParticipants = chat.participants.filter(
      (participantObjectId) =>
        participantObjectId.toString() !== req.user?._id.toString()
    );

    chat.participants = updatedParticipants;
    await chat.save();

    const updatedChat = await Chat.aggregate([
      {
        $match: {
          _id: chat._id,
        },
      },
      ...chatCommonAggregation(),
    ]);

    if (!updatedChat.length) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Internal Srever Error"
      );
    }

    chat.participants.forEach((participantObjectId) => {
      if (participantObjectId.toString() === req.user?._id.toString()) return;

      emitSocketEvent(
        req,
        participantObjectId.toString(),
        ChatEventEnum.LEAVE_CHAT_EVENT,
        updatedChat[0]
      );
    });

    return res
      .status(StatusCodes.OK)
      .json(
        new ApiResponse(StatusCodes.OK, "You have left the chat", updatedChat)
      );
  }
);

//removeParticipantFromGroupChat
export const removeParticipantFromGroupChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { serverId, chatId } = req.params;
    const { participantId } = req.body;

    //get server and chat and perform checks
    const server = await Server.findById(new mongoose.Types.ObjectId(serverId));
    if (!server) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid server id");
    }

    let filteredMebers = server.members.filter(
      (member) => member.user.toString() === req.user?._id.toString()
    );
    if (!filteredMebers.length) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "User isnt in the server");
    }

    const chat = await Chat.findOne({
      _id: new mongoose.Types.ObjectId(chatId),
      server: server._id,
      isGroupChat: true,
    });
    if (!chat) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid chat id");
    }

    //check if user is participant and owner or admin in server
    let isOwnerOrAdmin =
      filteredMebers[0].role === "owner" || filteredMebers[0].role === "admin";
    let isParticipant = chat.participants.some((participant) =>
      participant.equals(req.user?._id)
    );
    if (!isOwnerOrAdmin || !isParticipant) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "You cannot remove a participant"
      );
    }

    //check that the participant isnt a owner or admin and is also part of the group
    filteredMebers = server.members.filter(
      (member) => member.user.toString() === participantId
    );
    if (!filteredMebers.length) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Participant isnt in the server"
      );
    }

    isOwnerOrAdmin =
      filteredMebers[0].role === "owner" || filteredMebers[0].role === "admin";
    if (isOwnerOrAdmin) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Cannot remove the owner or admin of a server"
      );
    }

    isParticipant = chat.participants.some(
      (participant) => participant.toString() === participantId
    );
    if (!isParticipant) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Participant isnt part of the group"
      );
    }

    //filter out all the other participants and update chat.participants
    const updatedParticipants = chat.participants.filter(
      (participant) => participant.toString() !== participantId
    );
    chat.participants = updatedParticipants;
    await chat.save();

    //form updated chat aggregation
    const updatedChat = await Chat.aggregate([
      {
        $match: {
          _id: chat._id,
        },
      },
      ...chatCommonAggregation(),
    ]);

    if (!updatedChat.length) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Internal Srever Error"
      );
    }

    //emit socket event
    chat.participants.forEach((participantObjectId) => {
      if (participantObjectId.toString() === req.user?._id.toString()) return;

      emitSocketEvent(
        req,
        participantObjectId.toString(),
        ChatEventEnum.LEAVE_CHAT_EVENT,
        updatedChat[0]
      );
    });

    emitSocketEvent(
      req,
      participantId,
      ChatEventEnum.LEAVE_CHAT_EVENT,
      updatedChat
    );

    //return api response
    return res
      .status(StatusCodes.OK)
      .json(
        new ApiResponse(
          StatusCodes.OK,
          "Participant has been removed",
          updatedChat
        )
      );
  }
);

//addParticipantsToGroupChat
export const addParticipantToGroupChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { serverId, chatId } = req.params;
    const { newParticipantId } = req.body;

    //get server and chat and perform checks
    const server = await Server.findById(new mongoose.Types.ObjectId(serverId));
    if (!server) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid server id");
    }

    let filteredMebers = server.members.filter(
      (member) => member.user.toString() === req.user?._id.toString()
    );
    if (!filteredMebers.length) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "User isnt in the server");
    }

    const chat = await Chat.findOne({
      _id: new mongoose.Types.ObjectId(chatId),
      server: server._id,
      isGroupChat: true,
    });
    if (!chat) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid chat id");
    }

    //check if user is participant and owner or admin in server
    let isOwnerOrAdmin =
      filteredMebers[0].role === "owner" || filteredMebers[0].role === "admin";
    let isParticipant = chat.participants.some((participant) =>
      participant.equals(req.user?._id)
    );
    if (!isOwnerOrAdmin || !isParticipant) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "You cannot add a participant in this group"
      );
    }

    //check if the newParticipantId is in server
    filteredMebers = server.members.filter(
      (member) => member.user.toString() === newParticipantId
    );
    if (!filteredMebers.length) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "New Participant isnt in the server"
      );
    }

    //check if already in chat
    if (
      chat.participants.some(
        (participant) => participant.toString() === newParticipantId
      )
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Participant is already a part of the chat"
      );
    }

    //update the participant list with the new participant id
    chat.participants = [
      ...chat.participants,
      new mongoose.Types.ObjectId(newParticipantId as string),
    ];
    await chat.save();

    //aggregate the chat
    const updatedChat = await Chat.aggregate([
      {
        $match: {
          _id: chat._id,
        },
      },
      ...chatCommonAggregation(),
    ]);

    if (!updatedChat.length) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Internal Srever Error"
      );
    }

    //emit socket event
    chat.participants.forEach((participantObjectId) => {
      if (participantObjectId.toString() === req.user?._id.toString()) return;

      emitSocketEvent(
        req,
        participantObjectId.toString(),
        ChatEventEnum.JOIN_CHAT_EVENT,
        updatedChat[0]
      );
    });

    emitSocketEvent(
      req,
      newParticipantId,
      ChatEventEnum.JOIN_CHAT_EVENT,
      updatedChat[0]
    );

    //return api response
    return res
      .status(StatusCodes.OK)
      .json(
        new ApiResponse(
          StatusCodes.OK,
          "Participant has been added",
          updatedChat
        )
      );
  }
);
