import { Types } from "mongoose";

export type IUser = {
  username: string;
  password: string;
  email: string;
  dateOfBirth: Date;
  displayName: string;
  refreshToken?: string | undefined;
  friends: Types.ObjectId[];
  sentRequests: Types.ObjectId[];
  receivedRequests: Types.ObjectId[];

  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAccessToken(): string;
  generateRefreshToken(): string;
};
