import { z } from "zod";

export const projectIdParamSchema = {
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
};

export const eventIdParamSchema = {
  params: z.object({
    eventId: z.string().uuid("Invalid event ID format"),
  }),
};

export const trackQuerySchema = {
  query: z.object({
    track: z.string().optional(),
  }),
};

export const scoreBodySchema = {
  body: z.object({
    innovation: z.number().int().min(1, "Score must be at least 1").max(10, "Score must be at most 10"),
    technical: z.number().int().min(1, "Score must be at least 1").max(10, "Score must be at most 10"),
    impact: z.number().int().min(1, "Score must be at least 1").max(10, "Score must be at most 10"),
    presentation: z.number().int().min(1, "Score must be at least 1").max(10, "Score must be at most 10"),
    comments: z.string().optional(),
  }),
};

export const updateScoreBodySchema = {
  body: z.object({
    innovation: z.number().int().min(1).max(10).optional(),
    technical: z.number().int().min(1).max(10).optional(),
    impact: z.number().int().min(1).max(10).optional(),
    presentation: z.number().int().min(1).max(10).optional(),
    comments: z.string().optional(),
  }),
};
