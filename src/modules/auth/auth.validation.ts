import { z } from "zod";

export const registerSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    fullName: z.string().min(1, "Full name is required"),
    avatarUrl: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
    bio: z.string().max(500, "Bio must be at most 500 characters").optional(),
    githubUrl: z.string().url("Invalid GitHub URL").optional().or(z.literal("")),
    linkedinUrl: z.string().url("Invalid LinkedIn URL").optional().or(z.literal("")),
  }),
};

export const loginSchema = {
  body: z
    .object({
      email: z.string().email("Invalid email address").optional(),
      username: z.string().optional(),
      password: z.string().min(1, "Password is required"),
    })
    .refine((data) => data.email || data.username, {
      message: "Either email or username must be provided",
      path: ["email"],
    }),
};

export const updateMeSchema = {
  body: z.object({
    fullName: z.string().min(1, "Full name cannot be empty").optional(),
    avatarUrl: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
    bio: z.string().max(500, "Bio must be at most 500 characters").optional(),
    githubUrl: z.string().url("Invalid GitHub URL").optional().or(z.literal("")),
    linkedinUrl: z.string().url("Invalid LinkedIn URL").optional().or(z.literal("")),
    password: z.string().min(6, "Password must be at least 6 characters").optional(),
  }),
};
