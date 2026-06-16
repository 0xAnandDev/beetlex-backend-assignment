import { z } from "zod";

export const eventIdParamSchema = {
  params: z.object({
    eventId: z.string().uuid("Invalid event ID format"),
  }),
};

export const eventAndTeamIdParamsSchema = {
  params: z.object({
    eventId: z.string().uuid("Invalid event ID format"),
    teamId: z.string().uuid("Invalid team ID format"),
  }),
};

export const createTeamSchema = {
  body: z.object({
    name: z.string().min(3, "Team name must be at least 3 characters").max(50, "Team name must be at most 50 characters"),
  }),
};
