import mongoose from "mongoose";

export interface IChatSchema extends Document {
  name?: string;
  isGroupChat: boolean;
  lastMessage?: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  unreadMessages?: Map<mongoose.Types.ObjectId, number>;
  server?: mongoose.Types.ObjectId;
}
