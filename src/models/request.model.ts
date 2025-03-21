import { Schema, model, Model } from "mongoose";
import { TFriendRequest } from "../types/friendRequest.type";

export const FriendRequestSchema = new Schema<TFriendRequest>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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

// Prevent duplicate requests between same sender and receiver
FriendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });

const FriendRequest: Model<TFriendRequest> = model(
  "FriendRequest",
  FriendRequestSchema
);

export default FriendRequest;
