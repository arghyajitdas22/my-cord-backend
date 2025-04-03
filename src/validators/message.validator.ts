import { Document, Types } from "mongoose";

export interface IMessageSchema extends Document {
  sender: Types.ObjectId;
  chat: Types.ObjectId;
  content: string;
  attachments: {
    url: string;
    localPath?: string;
    type?: "image" | "video" | "file";
  }[];
  isEdited: boolean;
  isDeleted: boolean;
}
