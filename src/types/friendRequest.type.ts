import { Types } from "mongoose";

export type TFriendRequest = {
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  status: string;
};
