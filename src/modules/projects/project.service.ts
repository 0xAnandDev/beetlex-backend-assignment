import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/errors";
import { ProjectStatus } from "@prisma/client";

export class ProjectService {
  static async createDraft(teamId: string, data: any, userId: string) {
    // 1. Verify user belongs to the team
    const registration = await prisma.registration.findFirst({
      where: { teamId, userId, status: { not: "cancelled" } },
    });
    if (!registration) {
      throw new AppError("You do not belong to this team", 403, "FORBIDDEN_ERROR");
    }

    // 2. Fetch team to retrieve eventId
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    if (!team) {
      throw new AppError("Team not found", 404, "NOT_FOUND_ERROR");
    }
    const eventId = team.eventId;

    // 3. Verify unique constraint: one project per team per event
    const existing = await prisma.project.findFirst({
      where: { eventId, teamId },
    });
    if (existing) {
      throw new AppError("A project already exists for this team in this event", 409, "CONFLICT_ERROR");
    }

    // 4. Create the project draft
    return prisma.project.create({
      data: {
        eventId,
        teamId,
        title: data.title,
        description: data.description,
        techStack: data.techStack,
        status: ProjectStatus.draft,
      },
    });
  }

  static async getProjectByTeam(teamId: string, userId: string, userRole: string) {
    // 1. Verify user belongs to the team (admin can bypass membership checks)
    if (userRole !== "admin") {
      const registration = await prisma.registration.findFirst({
        where: { teamId, userId, status: { not: "cancelled" } },
      });
      if (!registration) {
        throw new AppError("You do not belong to this team", 403, "FORBIDDEN_ERROR");
      }
    }

    // 2. Retrieve project
    const project = await prisma.project.findUnique({
      where: { teamId },
    });
    if (!project) {
      throw new AppError("Project not found for this team", 404, "NOT_FOUND_ERROR");
    }

    return project;
  }

  static async updateDraft(teamId: string, data: any, userId: string) {
    // 1. Verify user belongs to the team
    const registration = await prisma.registration.findFirst({
      where: { teamId, userId, status: { not: "cancelled" } },
    });
    if (!registration) {
      throw new AppError("You do not belong to this team", 403, "FORBIDDEN_ERROR");
    }

    // 2. Retrieve project and check status
    const project = await prisma.project.findUnique({
      where: { teamId },
    });
    if (!project) {
      throw new AppError("Project not found", 404, "NOT_FOUND_ERROR");
    }
    if (project.status !== ProjectStatus.draft) {
      throw new AppError("Project is already submitted and cannot be edited", 400, "BAD_REQUEST");
    }

    // 3. Update the fields
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.techStack !== undefined) updateData.techStack = data.techStack;
    if (data.demoUrl !== undefined) updateData.demoUrl = data.demoUrl || null;
    if (data.repoUrl !== undefined) updateData.repoUrl = data.repoUrl || null;
    if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl || null;

    return prisma.project.update({
      where: { teamId },
      data: updateData,
    });
  }

  static async submitProject(teamId: string, userId: string) {
    // 1. Verify user belongs to the team
    const registration = await prisma.registration.findFirst({
      where: { teamId, userId, status: { not: "cancelled" } },
    });
    if (!registration) {
      throw new AppError("You do not belong to this team", 403, "FORBIDDEN_ERROR");
    }

    // 2. Retrieve project and its associated event details
    const project = await prisma.project.findUnique({
      where: { teamId },
      include: {
        event: {
          select: {
            submissionDeadline: true,
          },
        },
      },
    });
    if (!project) {
      throw new AppError("Project not found", 404, "NOT_FOUND_ERROR");
    }
    if (project.status !== ProjectStatus.draft) {
      throw new AppError("Project is already submitted", 400, "BAD_REQUEST");
    }

    // 3. Verify submission deadline has not passed
    const now = new Date();
    if (now > project.event.submissionDeadline) {
      throw new AppError("Submission deadline has passed", 400, "DEADLINE_PASSED");
    }

    // 4. Set status to submitted and record submission timestamp
    return prisma.project.update({
      where: { teamId },
      data: {
        status: ProjectStatus.submitted,
        submittedAt: now,
      },
    });
  }

  static async uploadDeck(teamId: string, deckUrl: string, userId: string) {
    // 1. Verify user belongs to the team
    const registration = await prisma.registration.findFirst({
      where: { teamId, userId, status: { not: "cancelled" } },
    });
    if (!registration) {
      throw new AppError("You do not belong to this team", 403, "FORBIDDEN_ERROR");
    }

    // 2. Retrieve project and verify it is a draft
    const project = await prisma.project.findUnique({
      where: { teamId },
    });
    if (!project) {
      throw new AppError("Project not found", 404, "NOT_FOUND_ERROR");
    }
    if (project.status !== ProjectStatus.draft) {
      throw new AppError("Cannot upload deck after project submission", 400, "BAD_REQUEST");
    }

    // 3. Generate mock CDN URL
    const cdnUrl = `https://cdn.beetlex.org/decks/projects/${project.id}.pdf`;

    // 4. Save inside database and return mock CDN URL
    await prisma.project.update({
      where: { teamId },
      data: { deckUrl: cdnUrl },
    });

    return cdnUrl;
  }

  static async findAllForEvent(eventId: string, userId: string, userRole: string) {
    // 1. Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    // 2. Authorization check: Only organizer, assigned judge, or admin can access
    let isAuthorized = false;
    if (userRole === "admin") {
      isAuthorized = true;
    } else if (event.organizerId === userId) {
      isAuthorized = true;
    } else {
      const judgeAssignment = await prisma.eventJudge.findUnique({
        where: {
          eventId_judgeId: {
            eventId,
            judgeId: userId,
          },
        },
      });
      if (judgeAssignment) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new AppError("You do not have permission to view submissions for this event", 403, "FORBIDDEN_ERROR");
    }

    // 3. Retrieve all non-draft projects
    return prisma.project.findMany({
      where: {
        eventId,
        status: {
          in: [ProjectStatus.submitted, ProjectStatus.under_review, ProjectStatus.scored],
        },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
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
        },
      },
      orderBy: { submittedAt: "desc" },
    });
  }
}
