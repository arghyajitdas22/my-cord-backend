import { Schema, model, Model } from "mongoose";
import { TFriendRequest } from "../types/friendRequest.type";

const FriendRequestSchema = new Schema<TFriendRequest>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

const FriendRequest: Model<TFriendRequest> = model(
  "FriendRequest",
  FriendRequestSchema
);
