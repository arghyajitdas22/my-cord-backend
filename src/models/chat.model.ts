import { Schema, Model, model } from "mongoose";
import { IChatSchema } from "../validators/chat.validator";

const chatSchema = new Schema<IChatSchema>(
  {
    name: {
      type: String,
      required: false,
    },
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    server: {
      type: Schema.Types.ObjectId,
      ref: "Server",
      required: false,
      index: true,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    unreadMessages: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

const Chat: Model<IChatSchema> = model<IChatSchema>("Chat", chatSchema);
export default Chat;
