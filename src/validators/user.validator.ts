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

const registerUserSchema = z.object({
  username: z
    .string({ required_error: "Please provide a username" })
    .max(20)
    .trim(),
  password: z
    .string({ required_error: "Please provide a password" })
    .min(6)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/
    ),
  email: z
    .string({ required_error: "Please provide an email" })
    .email()
    .toLowerCase()
    .trim()
    .regex(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    ),
  displayName: z
    .string({ required_error: "Please provide a display name" })
    .trim(),
  dateOfBirth: z.object({
    day: z.number(),
    month: z.nativeEnum(Month),
    year: z.number(),
  }),
});

export { registerUserSchema };
