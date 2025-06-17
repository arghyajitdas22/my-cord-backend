import { Document, Types } from "mongoose";

export interface IMessageSchema extends Document {
  sender: Types.ObjectId;
  chat: Types.ObjectId;
  content: string;
  attachments: {
    url: string;
  }[];
  isEdited: boolean;
  isDeleted: boolean;
}
