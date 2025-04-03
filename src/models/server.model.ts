import { Schema, Model, model } from "mongoose";
import { IServerSchema } from "../validators/server.validator";

const serverSchema = new Schema<IServerSchema>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      url: {
        type: String,
        required: true,
      },
      localPath: {
        type: String,
        default: null,
      },
    },
    members: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: {
          type: String,
          enum: ["owner", "admin", "member"],
          default: "member",
        },
      },
    ],
  },
  { timestamps: true }
);

const Server: Model<IServerSchema> = model<IServerSchema>(
  "Server",
  serverSchema
);
export default Server;
