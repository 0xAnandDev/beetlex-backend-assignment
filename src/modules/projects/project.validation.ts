import { z } from "zod";

export const teamIdParamSchema = {
  params: z.object({
    teamId: z.string().uuid("Invalid team ID format"),
  }),
};

export const eventIdParamSchema = {
  params: z.object({
    eventId: z.string().uuid("Invalid event ID format"),
  }),
};

export const createProjectSchema = {
  body: z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(255, "Title must be at most 255 characters"),
    description: z.string().min(1, "Description is required").max(2000, "Description must be at most 2000 characters"),
    techStack: z.array(z.string()).min(1, "At least one tech stack item is required"),
  }),
};

export const updateProjectSchema = {
  body: z.object({
    title: z.string().min(3).max(255).optional(),
    description: z.string().min(1).max(2000).optional(),
    techStack: z.array(z.string()).min(1).optional(),
    demoUrl: z.string().url("Invalid demo URL format").optional().or(z.literal("")).nullable(),
    repoUrl: z.string().url("Invalid repository URL format").optional().or(z.literal("")).nullable(),
    videoUrl: z.string().url("Invalid video URL format").optional().or(z.literal("")).nullable(),
  }),
};

export const uploadDeckSchema = {
  body: z.object({
    deckUrl: z.string().url("Invalid deck URL format"),
  }),
};
