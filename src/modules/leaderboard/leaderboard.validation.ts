import { z } from "zod";

export const eventIdParamSchema = {
  params: z.object({
    eventId: z.string().uuid("Invalid event ID format"),
  }),
};
