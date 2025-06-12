import { Server, Socket } from "socket.io";
import { ChatEventEnum } from "../constants";
import cookie from "cookie";
import { ApiError } from "../utils/ApiError";
import { StatusCodes } from "http-status-codes";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../models/user.model";
import { Types } from "mongoose";
import { Request } from "express";

const mountJoinChatEvent = (socket: Socket) => {
  socket.on(ChatEventEnum.JOIN_CHAT_EVENT, (chatId: string) => {
    console.log(`User joined the chat 🤝. chatId: ${chatId}`);
    socket.join(chatId);
  });
};

const mountParticipantTypingEvent = (socket: Socket) => {
  socket.on(ChatEventEnum.TYPING_EVENT, (chatId: string) => {
    socket.in(chatId).emit(ChatEventEnum.TYPING_EVENT, chatId);
  });
};

const mountParticipantStopTypingEvent = (socket: Socket) => {
  socket.on(ChatEventEnum.STOP_TYPING_EVENT, (chatId: string) => {
    socket.in(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, chatId);
  });
};

interface DecodedToken extends JwtPayload {
  _id: Types.ObjectId;
}

const initializeSocketIO = (io: Server) => {
  io.on("connection", async (socket: Socket) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers?.cookie || "");
      let accessToken = cookies?.accessToken;

      if (!accessToken) {
        accessToken = socket.handshake.auth?.token;
      }

      if (!accessToken) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          "Unauthorized hanshake - no token found"
        );
      }

      const decodedAccessToken = jwt.verify(
        accessToken,
        process.env.ACCESS_TOKEN_SECRET as string
      );
      const user = await User.findById((decodedAccessToken as any).userId);
      if (!user) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          "Invalid token - no user found"
        );
      }

      (socket as any).user = user;
      socket.join(user._id.toString());
      socket.emit(ChatEventEnum.CONNECTED_EVENT);
      console.log("User connected 🗼. userId: ", user._id.toString());

      mountJoinChatEvent(socket);
      mountParticipantTypingEvent(socket);
      mountParticipantStopTypingEvent(socket);

      socket.on("disconnect", () => {
        console.log(
          "User disconnected 🚫. userId: " +
            (socket as any).user?._id.toString()
        );
        if ((socket as any).user._id) {
          socket.leave((socket as any).user._id.toString());
        }
      });
    } catch (error) {
      socket.emit(
        ChatEventEnum.SOCKET_ERROR_EVENT,
        (error as Error).message || "Error while connecting to the socket."
      );
    }
  });
};

const emitSocketEvent = (
  req: Request,
  roomId: string,
  event: string,
  payload: any
): void => {
  const io: Server = req.app.get("io");
  io.in(roomId).emit(event, payload);
};

export { initializeSocketIO, emitSocketEvent };
