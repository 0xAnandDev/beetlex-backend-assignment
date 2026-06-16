import { FastifyReply, FastifyRequest } from "fastify";
import { AnnouncementService } from "./announcement.service";
import { successResponse } from "../../utils/response";
import { AnnouncementPriority, AnnouncementTarget } from "@prisma/client";

export class AnnouncementController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { eventId } = request.params as { eventId: string };
    const body = request.body as {
      title: string;
      body: string;
      priority?: AnnouncementPriority;
      target?: AnnouncementTarget;
      isPublished?: boolean;
    };

    const announcement = await AnnouncementService.createAnnouncement(
      eventId,
      request.user!.id,
      request.user!.role,
      body
    );

    return reply.status(201).send(successResponse(announcement, "Announcement created successfully"));
  }

  static async publish(request: FastifyRequest, reply: FastifyReply) {
    const { eventId, annId } = request.params as { eventId: string; annId: string };

    const announcement = await AnnouncementService.publishAnnouncement(
      eventId,
      request.user!.id,
      request.user!.role,
      annId
    );

    return reply.status(200).send(successResponse(announcement, "Announcement published successfully"));
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { eventId } = request.params as { eventId: string };

    const announcements = await AnnouncementService.listAnnouncements(
      eventId,
      request.user!.id,
      request.user!.role
    );

    return reply.status(200).send(successResponse(announcements, "Announcements list retrieved successfully"));
  }

  static async markAsRead(request: FastifyRequest, reply: FastifyReply) {
    const { eventId, annId } = request.params as { eventId: string; annId: string };

    await AnnouncementService.markAsRead(
      eventId,
      request.user!.id,
      request.user!.role,
      annId
    );

    return reply.status(200).send(successResponse(null, "Announcement marked as read"));
  }

  static async getUnreadCount(request: FastifyRequest, reply: FastifyReply) {
    const { eventId } = request.params as { eventId: string };

    const unreadData = await AnnouncementService.getUnreadCount(
      eventId,
      request.user!.id,
      request.user!.role
    );

    return reply.status(200).send(successResponse(unreadData, "Unread announcements count retrieved successfully"));
  }
}
