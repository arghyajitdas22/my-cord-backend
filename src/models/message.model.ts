import { Schema, model, Model } from "mongoose";
import { IMessageSchema } from "../validators/message.validator";

const messageSchema = new Schema<IMessageSchema>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    attachments: [
      {
        url: {
          type: String,
          required: true,
        },
        localPath: {
          type: String,
          default: null,
        },
        type: {
          type: String,
          enum: ["image", "video", "file"],
          default: null,
        },
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Message: Model<IMessageSchema> = model<IMessageSchema>(
  "Message",
  messageSchema
);
export default Message;
