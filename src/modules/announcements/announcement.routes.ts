import { FastifyInstance } from "fastify";
import { AnnouncementController } from "./announcement.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import {
  eventIdParamSchema,
  eventIdAndAnnIdParamsSchema,
  createAnnouncementSchema,
} from "./announcement.validation";

export async function announcementRoutes(fastify: FastifyInstance) {
  // GET /events/:eventId/announcements/unread-count
  fastify.get(
    "/:eventId/announcements/unread-count",
    {
      preHandler: [authenticate, validate(eventIdParamSchema)],
    },
    AnnouncementController.getUnreadCount
  );

  // GET /events/:eventId/announcements
  fastify.get(
    "/:eventId/announcements",
    {
      preHandler: [authenticate, validate(eventIdParamSchema)],
    },
    AnnouncementController.list
  );

  // POST /events/:eventId/announcements
  fastify.post(
    "/:eventId/announcements",
    {
      preHandler: [authenticate, validate(eventIdParamSchema), validate(createAnnouncementSchema)],
    },
    AnnouncementController.create
  );

  // POST /events/:eventId/announcements/:annId/publish
  fastify.post(
    "/:eventId/announcements/:annId/publish",
    {
      preHandler: [authenticate, validate(eventIdAndAnnIdParamsSchema)],
    },
    AnnouncementController.publish
  );

  // POST /events/:eventId/announcements/:annId/read
  fastify.post(
    "/:eventId/announcements/:annId/read",
    {
      preHandler: [authenticate, validate(eventIdAndAnnIdParamsSchema)],
    },
    AnnouncementController.markAsRead
  );
}
