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
      type: String,
      required: true,
    },
    members: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
          index: true,
        },
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

serverSchema.pre("save", async function (next) {
  const server = this as IServerSchema;
  const ownerIsAlreadyInMembers = server.members.some(
    (member) => member.user.toString() === server.owner.toString()
  );
  if (!ownerIsAlreadyInMembers) {
    server.members.push({ user: server.owner, role: "owner" });
  }
  next();
});

const Server: Model<IServerSchema> = model<IServerSchema>(
  "Server",
  serverSchema
);
export default Server;
