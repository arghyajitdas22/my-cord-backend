import mongoose from "mongoose";

export interface IChatSchema extends Document {
  name?: string;
  isGroupChat: boolean;
  lastMessage?: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  server?: mongoose.Types.ObjectId;
}
