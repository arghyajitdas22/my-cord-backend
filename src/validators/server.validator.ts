import mongoose from "mongoose";
import { z } from "zod";

export interface IServerSchema {
  owner: mongoose.Types.ObjectId;
  name: string;
  avatar: string;
  members: {
    user: mongoose.Types.ObjectId;
    role: "owner" | "admin" | "member";
  }[];
}

export const createServerSchema = z.object({
  owner: z.custom<mongoose.Types.ObjectId>(
    (val) => mongoose.Types.ObjectId.isValid(val),
    {
      message: "Invalid owner ObjectId",
    }
  ),
  name: z.string({ required_error: "Please provide a server name" }).trim(),
  avatar: z.string({ required_error: "Please provide an avatar url" }).trim(),
  members: z
    .array(
      z.object({
        user: z.custom<mongoose.Types.ObjectId>(
          (val) => mongoose.Types.ObjectId.isValid(val),
          {
            message: "Invalid user ObjectId",
          }
        ),
        role: z.enum(["owner", "admin", "member"]),
      })
    )
    .optional(),
});
