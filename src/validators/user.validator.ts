import { z } from "zod";

enum Month {
  January = "January",
  February = "February",
  March = "March",
  April = "April",
  May = "May",
  June = "June",
  July = "July",
  August = "August",
  September = "September",
  October = "October",
  November = "November",
  December = "December",
}

const monthMap: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const registerUserSchema = z.object({
  email: z
    .string({ required_error: "Please provide an email" })
    .email()
    .toLowerCase()
    .trim()
    .regex(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      {
        message: "Please provide a valid email address",
      }
    ),
  displayName: z
    .string({ required_error: "Please provide a display name" })
    .trim(),
  username: z
    .string({ required_error: "Please provide a username" })
    .max(20)
    .trim(),
  password: z
    .string({ required_error: "Please provide a password" })
    .min(6)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/,
      {
        message:
          "Password must contain at least 6 characters, including one uppercase letter, one lowercase letter, one number and one special character",
      }
    ),
  dateOfBirth: z
    .object({
      day: z.number().min(1).max(31, "Invalid day"),
      month: z.union([
        z.number().min(1).max(12, "Invalid month"),
        z
          .enum([
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ])
          .transform((m) => monthMap[m.toLowerCase()]),
      ]),
      year: z.number().max(new Date().getFullYear(), "Invalid year"),
    })
    .transform(({ day, month, year }) => {
      const dob = new Date(year, month - 1, day);
      if (isNaN(dob.getTime())) throw new Error("Invalid date combination");
      return dob;
    }),
});

const loginUserSchema = z.object({
  email: z
    .string({ required_error: "Please provide an email" })
    .email()
    .toLowerCase()
    .trim()
    .regex(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      {
        message: "Please provide a valid email address",
      }
    ),
  password: z
    .string({ required_error: "Please provide a password" })
    .min(6)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/,
      {
        message:
          "Password must contain at least 6 characters, including one uppercase letter, one lowercase letter, one number and one special character",
      }
    ),
});

export { registerUserSchema, loginUserSchema };
