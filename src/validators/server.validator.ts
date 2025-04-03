import mongoose from "mongoose";

export interface IServerSchema {
  owner: mongoose.Types.ObjectId;
  name: string;
  avatar: {
    url: string;
    localPath?: string;
  };
  chats: mongoose.Types.ObjectId[];
  members: {
    user: mongoose.Types.ObjectId;
    role: "owner" | "admin" | "member";
  }[];
  admins: mongoose.Types.ObjectId[];
}
