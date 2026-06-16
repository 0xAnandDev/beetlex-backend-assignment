import { z } from "zod";
import { AnnouncementPriority, AnnouncementTarget } from "@prisma/client";

export const eventIdParamSchema = {
  params: z.object({
    eventId: z.string().uuid("Invalid event ID format"),
  }),
};

export const eventIdAndAnnIdParamsSchema = {
  params: z.object({
    eventId: z.string().uuid("Invalid event ID format"),
    annId: z.string().uuid("Invalid announcement ID format"),
  }),
};

export const createAnnouncementSchema = {
  body: z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title must be at most 100 characters"),
    body: z.string().min(5, "Body must be at least 5 characters").max(1000, "Body must be at most 1000 characters"),
    priority: z.nativeEnum(AnnouncementPriority).optional().default(AnnouncementPriority.info),
    target: z.nativeEnum(AnnouncementTarget).optional().default(AnnouncementTarget.all),
    isPublished: z.boolean().optional().default(false),
  }),
};
