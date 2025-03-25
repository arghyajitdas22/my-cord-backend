import { Types } from "mongoose";

export type TFriendRequest = {
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  status: string;
};

export enum FriendRequestStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}
