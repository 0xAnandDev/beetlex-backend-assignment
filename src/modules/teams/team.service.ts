import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/errors";

export class TeamService {
  static async create(eventId: string, name: string, userId: string) {
    // 1. Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    // 2. Verify user has a registration
    const registration = await prisma.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!registration) {
      throw new AppError("You must be registered for the event to create a team", 403, "FORBIDDEN_ERROR");
    }
    if (registration.status === "cancelled") {
      throw new AppError("Your registration for this event has been cancelled", 403, "FORBIDDEN_ERROR");
    }

    // 3. Ensure user is not already in a team
    if (registration.teamId) {
      throw new AppError("You are already in a team for this event", 409, "CONFLICT_ERROR");
    }

    // 4. Ensure team name is unique for this event
    const nameExists = await prisma.team.findUnique({
      where: {
        eventId_name: {
          eventId,
          name,
        },
      },
    });
    if (nameExists) {
      throw new AppError("A team with this name already exists in this event", 409, "CONFLICT_ERROR");
    }

    // 5. Create team and update user registration inside a transaction
    return prisma.$transaction(async (tx) => {
      const createdTeam = await tx.team.create({
        data: {
          name,
          eventId,
          leaderId: userId,
          inviteCode: Math.random().toString(36).substring(2, 10).toUpperCase(), // satisfies schema constraint
        },
      });

      await tx.registration.update({
        where: { eventId_userId: { eventId, userId } },
        data: { teamId: createdTeam.id },
      });

      return createdTeam;
    });
  }

  static async join(eventId: string, teamId: string, userId: string) {
    // 1. Verify user registration
    const registration = await prisma.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!registration) {
      throw new AppError("You must be registered for the event to join a team", 403, "FORBIDDEN_ERROR");
    }
    if (registration.status === "cancelled") {
      throw new AppError("Your registration for this event has been cancelled", 403, "FORBIDDEN_ERROR");
    }

    // 2. Ensure user is not already in a team
    if (registration.teamId) {
      throw new AppError("You are already in a team for this event", 409, "CONFLICT_ERROR");
    }

    // 3. Verify target team exists and matches the event
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    if (!team || team.eventId !== eventId) {
      throw new AppError("Team not found in this event", 404, "NOT_FOUND_ERROR");
    }

    // 4. Check team size capacity (limit 4 members)
    const membersCount = await prisma.registration.count({
      where: { teamId },
    });
    if (membersCount >= 4) {
      throw new AppError("Team is already full", 409, "CONFLICT_ERROR");
    }

    // 5. Update user's registration
    return prisma.registration.update({
      where: { eventId_userId: { eventId, userId } },
      data: { teamId },
    });
  }

  static async leave(eventId: string, teamId: string, userId: string) {
    // 1. Verify user belongs to this team
    const registration = await prisma.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!registration || registration.teamId !== teamId) {
      throw new AppError("You do not belong to this team", 400, "BAD_REQUEST");
    }

    // 2. Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    if (!team || team.eventId !== eventId) {
      throw new AppError("Team not found in this event", 404, "NOT_FOUND_ERROR");
    }

    // 3. Process departure inside a transaction
    await prisma.$transaction(async (tx) => {
      // Remove teamId link on registration
      await tx.registration.update({
        where: { eventId_userId: { eventId, userId } },
        data: { teamId: null },
      });

      // If user was the leader, reassign leadership or clean up empty team
      if (team.leaderId === userId) {
        const nextMember = await tx.registration.findFirst({
          where: { teamId, userId: { not: userId } },
          orderBy: { registeredAt: "asc" },
        });

        if (nextMember) {
          // Reassign leadership to another member
          await tx.team.update({
            where: { id: teamId },
            data: { leaderId: nextMember.userId },
          });
        } else {
          // Delete empty team
          await tx.team.delete({
            where: { id: teamId },
          });
        }
      }
    });
  }

  static async findById(eventId: string, teamId: string) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        leader: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!team || team.eventId !== eventId) {
      throw new AppError("Team not found in this event", 404, "NOT_FOUND_ERROR");
    }

    // Retrieve members list from event registrations
    const registrations = await prisma.registration.findMany({
      where: { teamId },
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
    });

    const members = registrations.map((reg) => reg.user);

    return {
      id: team.id,
      name: team.name,
      eventId: team.eventId,
      leaderId: team.leaderId,
      createdAt: team.createdAt,
      leader: team.leader,
      members,
    };
  }

  static async findAll(eventId: string) {
    const eventExists = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!eventExists) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    const teams = await prisma.team.findMany({
      where: { eventId },
      include: {
        leader: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return teams.map((team) => {
      const { _count, ...rest } = team;
      return {
        ...rest,
        memberCount: _count.registrations,
      };
    });
  }
}
