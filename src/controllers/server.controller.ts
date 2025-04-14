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

    res.status(StatusCodes.CREATED).json(
      new ApiResponse(StatusCodes.CREATED, "Server has been created", {
        server,
      })
    );
  }
);

export const addMembersToServer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { serverId } = req.params;
    const { memberIds } = req.body;

    if (!memberIds || memberIds.length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Please provide member ids");
    }

    const server = await Server.findById(serverId);
    if (!server) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Server not found");
    }

    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found");
    }

    const filteredMembers = server.members.filter(
      (member) => member.user.toString() === userId.toString()
    );
    if (filteredMembers.length === 0) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "You are not a member of this server"
      );
    }
    if (
      filteredMembers[0].role !== "admin" &&
      filteredMembers[0].role !== "owner"
    ) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "You are not authorized to add members to this server"
      );
    }

    const usersToAdd = await User.find({ _id: { $in: memberIds } });
    if (usersToAdd.length !== memberIds.length) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Some members not found");
    }

    const membersAlreadyInServer = server.members.filter((member) =>
      memberIds.includes(member.user.toString())
    );
    if (membersAlreadyInServer.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Some members are already in the server"
      );
    }

    usersToAdd.forEach((user) => {
      server.members.push({ user: user._id, role: "member" });
    });
    await server.save({ validateBeforeSave: false });

    res
      .status(StatusCodes.OK)
      .json(new ApiResponse(StatusCodes.OK, "Members added to server", server));
  }
);

export const changeMemberRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { serverId } = req.params;
    const { role, memberId } = req.body;

    if (!role || !["admin", "member"].includes(role)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Please provide a valid role"
      );
    }

    const server = await Server.findById(serverId);
    if (!server) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Server not found");
    }

    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found");
    }

    const filteredMembers = server.members.filter(
      (member) => member.user.toString() === userId.toString()
    );
    if (filteredMembers.length === 0) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "You are not a member of this server"
      );
    }
    if (
      filteredMembers[0].role !== "admin" &&
      filteredMembers[0].role !== "owner"
    ) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "You are not authorized to change member role in this server"
      );
    }

    const memberToChangeRole = server.members.find(
      (member) => member.user.toString() === memberId.toString()
    );
    if (!memberToChangeRole) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Member not found in server");
    }
    if (memberToChangeRole.role === "owner") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "You cannot change the role of the owner"
      );
    }
    if (memberToChangeRole.role === role) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Member already has this role"
      );
    }

    memberToChangeRole.role = role;
    await server.save({ validateBeforeSave: false });

    res
      .status(StatusCodes.OK)
      .json(new ApiResponse(StatusCodes.OK, "Member role changed", server));
  }
);

export const removeMemberFromServer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { serverId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Please provide member id");
    }

    const server = await Server.findById(serverId);
    if (!server) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Server not found");
    }

    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found");
    }

    const filteredMembers = server.members.filter(
      (member) => member.user.toString() === userId.toString()
    );
    if (filteredMembers.length === 0) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "You are not a member of this server"
      );
    }
    if (
      filteredMembers[0].role !== "admin" &&
      filteredMembers[0].role !== "owner"
    ) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "You are not authorized to remove members from this server"
      );
    }

    const memberToRemove = server.members.find(
      (member) => member.user.toString() === memberId.toString()
    );
    if (!memberToRemove) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Member not found in server");
    }
    if (memberToRemove.role === "owner") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "You cannot remove the owner from the server"
      );
    }

    server.members = server.members.filter(
      (member) => member.user.toString() !== memberId.toString()
    );
    await server.save({ validateBeforeSave: false });

    res
      .status(StatusCodes.OK)
      .json(
        new ApiResponse(StatusCodes.OK, "Member removed from server", server)
      );
  }
);

export const getAllServers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found");
    }

    const servers = await Server.find({ "members.user": userId })
      .populate("members.user", "-password -refreshToken")
      .populate("owner", "-password -refreshToken")
      .sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, "Servers fetched successfully", {
        servers,
      })
    );
  }
);
