import { prisma } from "../../config/prisma";
import { slugify } from "../../utils/slug";
import { AppError } from "../../utils/errors";
import { User, EventStatus, Prisma } from "@prisma/client";

const organizerSelect = {
  select: {
    id: true,
    fullName: true,
    username: true,
    email: true,
    avatarUrl: true,
  },
};

export class EventService {
  static async create(data: any, organizerId: string) {
    const slug = slugify(data.title);

    // Verify slug uniqueness (just in case)
    const existing = await prisma.event.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new AppError("An event with a very similar title already exists. Please modify the title.", 409, "CONFLICT_ERROR");
    }

    return prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        slug,
        bannerUrl: data.bannerUrl || null,
        organizerId,
        maxTeamSize: data.maxTeamSize,
        minTeamSize: data.minTeamSize,
        maxRegistrations: data.maxRegistrations || null,
        registrationOpen: new Date(data.registrationOpen),
        registrationClose: new Date(data.registrationClose),
        eventStart: new Date(data.eventStart),
        eventEnd: new Date(data.eventEnd),
        submissionDeadline: new Date(data.submissionDeadline),
        timezone: data.timezone,
        prizePool: data.prizePool as Prisma.InputJsonValue,
        tags: data.tags,
        isPublic: data.isPublic,
        status: data.status as EventStatus,
      },
      include: {
        organizer: organizerSelect,
      },
    });
  }

  static async findAll(query: { page: number; limit: number; status?: EventStatus; search?: string }) {
    const { page, limit, status, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EventWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.title = {
        contains: search,
        mode: "insensitive",
      };
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          organizer: organizerSelect,
        },
      }),
      prisma.event.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: events,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  static async findById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: organizerSelect,
      },
    });

    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    return event;
  }

  static async update(id: string, data: any, user: User) {
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    // Authorization check: Only organizer who owns the event or admin can update
    if (user.role !== "admin" && event.organizerId !== user.id) {
      throw new AppError("You do not have permission to update this event", 403, "FORBIDDEN_ERROR");
    }

    // If dates or team sizes are updated, perform integrity validation combining updated and existing fields
    const registrationOpen = data.registrationOpen ? new Date(data.registrationOpen) : event.registrationOpen;
    const registrationClose = data.registrationClose ? new Date(data.registrationClose) : event.registrationClose;
    const eventStart = data.eventStart ? new Date(data.eventStart) : event.eventStart;
    const eventEnd = data.eventEnd ? new Date(data.eventEnd) : event.eventEnd;
    const submissionDeadline = data.submissionDeadline ? new Date(data.submissionDeadline) : event.submissionDeadline;
    const minTeamSize = data.minTeamSize !== undefined ? data.minTeamSize : event.minTeamSize;
    const maxTeamSize = data.maxTeamSize !== undefined ? data.maxTeamSize : event.maxTeamSize;

    if (registrationOpen >= registrationClose) {
      throw new AppError("Registration open date must be before registration close date", 400, "VALIDATION_ERROR");
    }
    if (registrationClose > eventStart) {
      throw new AppError("Registration close date must be before or equal to event start date", 400, "VALIDATION_ERROR");
    }
    if (eventStart >= eventEnd) {
      throw new AppError("Event start date must be before event end date", 400, "VALIDATION_ERROR");
    }
    if (submissionDeadline < eventStart || submissionDeadline > eventEnd) {
      throw new AppError("Submission deadline must be between event start and event end date", 400, "VALIDATION_ERROR");
    }
    if (minTeamSize > maxTeamSize) {
      throw new AppError("Minimum team size cannot be greater than maximum team size", 400, "VALIDATION_ERROR");
    }

    const updateData: Prisma.EventUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title; // Slug remains unchanged per instructions
    if (data.description !== undefined) updateData.description = data.description;
    if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl || null;
    if (data.maxTeamSize !== undefined) updateData.maxTeamSize = data.maxTeamSize;
    if (data.minTeamSize !== undefined) updateData.minTeamSize = data.minTeamSize;
    if (data.maxRegistrations !== undefined) updateData.maxRegistrations = data.maxRegistrations;
    if (data.registrationOpen !== undefined) updateData.registrationOpen = registrationOpen;
    if (data.registrationClose !== undefined) updateData.registrationClose = registrationClose;
    if (data.eventStart !== undefined) updateData.eventStart = eventStart;
    if (data.eventEnd !== undefined) updateData.eventEnd = eventEnd;
    if (data.submissionDeadline !== undefined) updateData.submissionDeadline = submissionDeadline;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.prizePool !== undefined) updateData.prizePool = data.prizePool as Prisma.InputJsonValue;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
    if (data.status !== undefined) updateData.status = data.status as EventStatus;

    return prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        organizer: organizerSelect,
      },
    });
  }

  static async delete(id: string, user: User) {
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    // Authorization check: Only organizer who owns the event or admin can delete
    if (user.role !== "admin" && event.organizerId !== user.id) {
      throw new AppError("You do not have permission to delete this event", 403, "FORBIDDEN_ERROR");
    }

    await prisma.event.delete({
      where: { id },
    });
  }
}
