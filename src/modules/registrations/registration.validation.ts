import { z } from "zod";

export const routeParamsSchema = {
  params: z.object({
    id: z.string().uuid("Invalid event ID format"),
  }),
};

export const registerBodySchema = {
  body: z.object({
    registrationData: z.record(z.string(), z.any()).optional().default({}),
  }),
};

export const queryRegistrationSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).default(10),
  }),
};
