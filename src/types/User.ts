export type IUser = {
  username: string;
  password: string;
  email: string;
  dateOfBirth: Date;
  displayName: string;
  refreshToken?: string | undefined;
};
