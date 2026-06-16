import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/errors";
import { AnnouncementTarget, AnnouncementPriority } from "@prisma/client";

export class AnnouncementService {
  static async createAnnouncement(
    eventId: string,
    authorId: string,
    userRole: string,
    data: {
      title: string;
      body: string;
      priority?: AnnouncementPriority;
      target?: AnnouncementTarget;
      isPublished?: boolean;
    }
  ) {
    // 1. Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    // 2. Authorization check: Only event organizer or admin can create
    if (userRole !== "admin" && event.organizerId !== authorId) {
      throw new AppError("You do not have permission to create announcements for this event", 403, "FORBIDDEN_ERROR");
    }

    const isPublished = data.isPublished ?? false;
    const publishedAt = isPublished ? new Date() : null;

    return prisma.announcement.create({
      data: {
        eventId,
        authorId,
        title: data.title,
        body: data.body,
        priority: data.priority ?? AnnouncementPriority.info,
        target: data.target ?? AnnouncementTarget.all,
        isPublished,
        publishedAt,
      },
    });
  }

  static async publishAnnouncement(eventId: string, userId: string, userRole: string, annId: string) {
    // 1. Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    // 2. Authorization check: Only event organizer or admin can publish
    if (userRole !== "admin" && event.organizerId !== userId) {
      throw new AppError("You do not have permission to publish announcements for this event", 403, "FORBIDDEN_ERROR");
    }

    // 3. Verify announcement exists and belongs to the event
    const announcement = await prisma.announcement.findUnique({
      where: { id: annId },
    });
    if (!announcement || announcement.eventId !== eventId) {
      throw new AppError("Announcement not found", 404, "NOT_FOUND_ERROR");
    }

    return prisma.announcement.update({
      where: { id: annId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  static async listAnnouncements(eventId: string, userId: string, userRole: string) {
    // 1. Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    const isOrganizerOrAdmin = userRole === "admin" || event.organizerId === userId;

    // 2. Verify registration and judge status
    const registration = await prisma.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    const hasRegistration = registration && registration.status !== "cancelled";

    const judge = await prisma.eventJudge.findUnique({
      where: { eventId_judgeId: { eventId, judgeId: userId } },
    });
    const isJudge = !!judge;

    // Check if user has any authorized role/relationship with the event
    if (!isOrganizerOrAdmin && !hasRegistration && !isJudge) {
      throw new AppError("You do not have permission to view announcements for this event", 403, "FORBIDDEN_ERROR");
    }

    // 3. Build visibility where clause
    const whereClause: any = {
      eventId,
      isPublished: true,
    };

    if (!isOrganizerOrAdmin) {
      const orConditions: any[] = [{ target: AnnouncementTarget.all }];
      if (hasRegistration) {
        orConditions.push({ target: AnnouncementTarget.participants });
      }
      if (isJudge) {
        orConditions.push({ target: AnnouncementTarget.judges });
        // Judges also see event-wide announcements
        if (!hasRegistration) {
          orConditions.push({ target: AnnouncementTarget.all });
        }
      }
      whereClause.OR = orConditions;
    }

    return prisma.announcement.findMany({
      where: whereClause,
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        publishedAt: "desc",
      },
    });
  }

  static async markAsRead(eventId: string, userId: string, userRole: string, annId: string) {
    // 1. Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    // 2. Verify announcement exists, belongs to the event, and is published
    const announcement = await prisma.announcement.findUnique({
      where: { id: annId },
    });
    if (!announcement || announcement.eventId !== eventId || !announcement.isPublished) {
      throw new AppError("Announcement not found", 404, "NOT_FOUND_ERROR");
    }

    const isOrganizerOrAdmin = userRole === "admin" || event.organizerId === userId;

    // 3. Verify user matches the target visibility rules
    const registration = await prisma.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    const hasRegistration = registration && registration.status !== "cancelled";

    const judge = await prisma.eventJudge.findUnique({
      where: { eventId_judgeId: { eventId, judgeId: userId } },
    });
    const isJudge = !!judge;

    let canSee = false;
    if (isOrganizerOrAdmin) {
      canSee = true;
    } else if (announcement.target === AnnouncementTarget.all && (hasRegistration || isJudge)) {
      canSee = true;
    } else if (announcement.target === AnnouncementTarget.participants && hasRegistration) {
      canSee = true;
    } else if (announcement.target === AnnouncementTarget.judges && isJudge) {
      canSee = true;
    } else if (announcement.target === AnnouncementTarget.organizers && isOrganizerOrAdmin) {
      canSee = true;
    }

    if (!canSee) {
      throw new AppError("You do not have permission to access this announcement", 403, "FORBIDDEN_ERROR");
    }

    // 4. Upsert read track record idempotently (empty update is idempotent)
    return prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: annId,
          userId,
        },
      },
      create: {
        announcementId: annId,
        userId,
      },
      update: {},
    });
  }

  static async getUnreadCount(eventId: string, userId: string, userRole: string) {
    // 1. Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    const isOrganizerOrAdmin = userRole === "admin" || event.organizerId === userId;

    // 2. Verify registration and judge status
    const registration = await prisma.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    const hasRegistration = registration && registration.status !== "cancelled";

    const judge = await prisma.eventJudge.findUnique({
      where: { eventId_judgeId: { eventId, judgeId: userId } },
    });
    const isJudge = !!judge;

    if (!isOrganizerOrAdmin && !hasRegistration && !isJudge) {
      throw new AppError("You do not have permission to view announcements for this event", 403, "FORBIDDEN_ERROR");
    }

    // 3. Build visibility where clause
    const whereClause: any = {
      eventId,
      isPublished: true,
      reads: {
        none: {
          userId,
        },
      },
    };

    if (!isOrganizerOrAdmin) {
      const orConditions: any[] = [{ target: AnnouncementTarget.all }];
      if (hasRegistration) {
        orConditions.push({ target: AnnouncementTarget.participants });
      }
      if (isJudge) {
        orConditions.push({ target: AnnouncementTarget.judges });
        if (!hasRegistration) {
          orConditions.push({ target: AnnouncementTarget.all });
        }
      }
      whereClause.OR = orConditions;
    }

    const count = await prisma.announcement.count({
      where: whereClause,
    });

    return { count };
  }
}
