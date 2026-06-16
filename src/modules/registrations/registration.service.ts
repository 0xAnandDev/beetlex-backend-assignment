import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/errors";
import { User, RegistrationStatus } from "@prisma/client";

export class RegistrationService {
  static async register(eventId: string, userId: string, data: any) {
    // 1. Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    // 2. Validate registration window (current time must be between registrationOpen and registrationClose)
    const now = new Date();
    if (now < event.registrationOpen) {
      throw new AppError("Registration has not opened yet", 400, "REGISTRATION_NOT_OPEN");
    }
    if (now > event.registrationClose) {
      throw new AppError("Registration has closed for this event", 400, "REGISTRATION_CLOSED");
    }

    // 3. Prevent duplicate registrations (including previously cancelled ones to raise 409 Conflict)
    const existing = await prisma.registration.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });
    if (existing) {
      throw new AppError("You are already registered for this event", 409, "CONFLICT_ERROR");
    }

    // 4. Create registration record
    return prisma.registration.create({
      data: {
        eventId,
        userId,
        registrationData: data.registrationData || {},
        status: RegistrationStatus.pending,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            eventStart: true,
            eventEnd: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            username: true,
          },
        },
      },
    });
  }

  static async getRegistrationStatus(eventId: string, userId: string) {
    // Verify event exists
    const eventExists = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!eventExists) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    const registration = await prisma.registration.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!registration) {
      throw new AppError("Registration not found for this event", 404, "NOT_FOUND_ERROR");
    }

    return registration;
  }

  static async cancelRegistration(eventId: string, userId: string) {
    // 1. Fetch registration including event start time
    const registration = await prisma.registration.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
      include: {
        event: {
          select: {
            eventStart: true,
          },
        },
      },
    });

    if (!registration) {
      throw new AppError("Registration not found", 404, "NOT_FOUND_ERROR");
    }

    if (registration.status === RegistrationStatus.cancelled) {
      throw new AppError("Registration is already cancelled", 400, "BAD_REQUEST");
    }

    // 2. Validate cancellation timeline: only allowed before eventStart
    const now = new Date();
    if (now >= registration.event.eventStart) {
      throw new AppError("Cannot cancel registration after the event has started", 400, "BAD_REQUEST");
    }

    // 3. Update registration status to cancelled (soft-cancel)
    return prisma.registration.update({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
      data: {
        status: RegistrationStatus.cancelled,
        cancelledAt: new Date(),
      },
    });
  }

  static async findEventRegistrations(eventId: string, query: { page: number; limit: number }, user: User) {
    // 1. Fetch event to verify existence and authorization
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    // 2. Authorization check: Only event organizer or admin can see the registrations list
    if (user.role !== "admin" && event.organizerId !== user.id) {
      throw new AppError("You do not have permission to view registrations for this event", 403, "FORBIDDEN_ERROR");
    }

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where: { eventId },
        skip,
        take: limit,
        orderBy: { registeredAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.registration.count({
        where: { eventId },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // TODO: Implement CSV export if required in future releases when schema/library support is available.

    return {
      data: registrations,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}
