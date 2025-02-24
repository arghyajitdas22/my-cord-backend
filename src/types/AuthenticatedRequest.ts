import { IUser } from "./User";
import { Request } from "express";
import { Types } from "mongoose";

export interface AuthenticatedRequest extends Request {
  user?: IUser & { _id: Types.ObjectId };
}
