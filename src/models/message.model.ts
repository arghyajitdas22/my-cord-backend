import { Schema, model, Model } from "mongoose";
import { IMessageSchema } from "../validators/message.validator";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

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
    attachments: {
      type: [
        {
          url: String,
        },
      ],
      default: [],
    },
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

messageSchema.plugin(mongooseAggregatePaginate);

const Message: Model<IMessageSchema> = model<IMessageSchema>(
  "Message",
  messageSchema
);
export default Message;
