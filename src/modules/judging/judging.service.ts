import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/errors";
import { ProjectStatus } from "@prisma/client";

export class JudgingService {
  static async findAssignedProjects(judgeId: string, track?: string) {
    // 1. Fetch event judge assignments for the current judge
    const assignments = await prisma.eventJudge.findMany({
      where: { judgeId },
    });

    if (assignments.length === 0) {
      return [];
    }

    const eventIds = assignments.map((ja) => ja.eventId);

    // 2. Fetch projects that are submitted (submitted, under_review, scored)
    const where: any = {
      eventId: { in: eventIds },
      status: {
        in: [ProjectStatus.submitted, ProjectStatus.under_review, ProjectStatus.scored],
      },
    };

    if (track) {
      where.team = { track };
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        team: {
          select: {
            id: true,
            name: true,
            track: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        scores: {
          where: { judgeId },
        },
      },
    });

    // 3. Compute score total for each project if the judge has already evaluated it
    return projects.map((p) => {
      const judgeScore = p.scores[0];
      let mappedScore = null;

      if (judgeScore) {
        const total = (judgeScore.innovation + judgeScore.technical + judgeScore.impact + judgeScore.presentation) / 4;
        mappedScore = {
          ...judgeScore,
          total,
        };
      }

      const { scores, ...rest } = p;
      return {
        ...rest,
        myScore: mappedScore,
      };
    });
  }

  static async getProjectWithMyScore(projectId: string, judgeId: string) {
    // 1. Fetch project details
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            track: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!project) {
      throw new AppError("Project not found", 404, "NOT_FOUND_ERROR");
    }

    // 2. Strict validation: Ensure judge is assigned to the event of this project
    const judgeAssignment = await prisma.eventJudge.findUnique({
      where: {
        eventId_judgeId: {
          eventId: project.eventId,
          judgeId,
        },
      },
    });

    if (!judgeAssignment) {
      throw new AppError("You are not assigned as a judge for this event", 403, "FORBIDDEN_ERROR");
    }

    // 3. Retrieve judge's existing score
    const score = await prisma.score.findUnique({
      where: {
        projectId_judgeId: {
          projectId,
          judgeId,
        },
      },
    });

    let mappedScore = null;
    if (score) {
      const total = (score.innovation + score.technical + score.impact + score.presentation) / 4;
      mappedScore = {
        ...score,
        total,
      };
    }

    return {
      project,
      myScore: mappedScore,
    };
  }

  static async createScore(projectId: string, data: any, judgeId: string) {
    // 1. Retrieve project and check eligibility
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new AppError("Project not found", 404, "NOT_FOUND_ERROR");
    }

    // Only non-draft (submitted, under_review, scored) projects can be scored
    const eligibleStatuses: ProjectStatus[] = [ProjectStatus.submitted, ProjectStatus.under_review, ProjectStatus.scored];
    if (!eligibleStatuses.includes(project.status)) {
      throw new AppError("Only submitted projects can be evaluated", 400, "BAD_REQUEST");
    }

    // 2. Strict validation: Ensure judge is assigned to this project's event
    const judgeAssignment = await prisma.eventJudge.findUnique({
      where: {
        eventId_judgeId: {
          eventId: project.eventId,
          judgeId,
        },
      },
    });

    if (!judgeAssignment) {
      throw new AppError("You are not assigned as a judge for this event", 403, "FORBIDDEN_ERROR");
    }

    // 3. Prevent duplicate scoring (verify judge hasn't scored this project yet)
    const existing = await prisma.score.findUnique({
      where: {
        projectId_judgeId: {
          projectId,
          judgeId,
        },
      },
    });

    if (existing) {
      throw new AppError("You have already scored this project", 409, "CONFLICT_ERROR");
    }

    // 4. Create score record and calculate total average
    const score = await prisma.score.create({
      data: {
        projectId,
        judgeId,
        innovation: data.innovation,
        technical: data.technical,
        impact: data.impact,
        presentation: data.presentation,
        comments: data.comments || null,
      },
    });

    const total = (score.innovation + score.technical + score.impact + score.presentation) / 4;

    return {
      ...score,
      total,
    };
  }

  static async updateScore(projectId: string, data: any, judgeId: string) {
    // 1. Fetch project details including event status
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        event: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!project) {
      throw new AppError("Project not found", 404, "NOT_FOUND_ERROR");
    }

    // 2. Strict validation: Ensure judge is assigned to this project's event
    const judgeAssignment = await prisma.eventJudge.findUnique({
      where: {
        eventId_judgeId: {
          eventId: project.eventId,
          judgeId,
        },
      },
    });

    if (!judgeAssignment) {
      throw new AppError("You are not assigned as a judge for this event", 403, "FORBIDDEN_ERROR");
    }

    // 3. Business logic check: block updates if event is closed
    if (project.event.status === "closed") {
      throw new AppError("Cannot update score after the event has closed", 400, "BAD_REQUEST");
    }

    // 4. Retrieve score
    const score = await prisma.score.findUnique({
      where: {
        projectId_judgeId: {
          projectId,
          judgeId,
        },
      },
    });

    if (!score) {
      throw new AppError("Score not found for this project", 404, "NOT_FOUND_ERROR");
    }

    // 5. Apply updates
    const updateData: any = {};
    if (data.innovation !== undefined) updateData.innovation = data.innovation;
    if (data.technical !== undefined) updateData.technical = data.technical;
    if (data.impact !== undefined) updateData.impact = data.impact;
    if (data.presentation !== undefined) updateData.presentation = data.presentation;
    if (data.comments !== undefined) updateData.comments = data.comments;

    const updated = await prisma.score.update({
      where: {
        projectId_judgeId: {
          projectId,
          judgeId,
        },
      },
      data: updateData,
    });

    const total = (updated.innovation + updated.technical + updated.impact + updated.presentation) / 4;

    return {
      ...updated,
      total,
    };
  }

  static async getEventScores(eventId: string, userId: string, userRole: string) {
    // 1. Fetch event
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    // 2. Authorization check: Only organizer or admin
    if (userRole !== "admin" && event.organizerId !== userId) {
      throw new AppError("You do not have permission to view scores for this event", 403, "FORBIDDEN_ERROR");
    }

    // 3. Fetch non-draft event projects and their scores
    const projects = await prisma.project.findMany({
      where: {
        eventId,
        status: {
          in: [ProjectStatus.submitted, ProjectStatus.under_review, ProjectStatus.scored],
        },
      },
      include: {
        team: {
          select: {
            name: true,
          },
        },
        scores: {
          include: {
            judge: {
              select: {
                id: true,
                fullName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    // 4. Form aggregated scores list
    return projects.map((p) => {
      const mappedScores = p.scores.map((s) => {
        const total = (s.innovation + s.technical + s.impact + s.presentation) / 4;
        return {
          id: s.id,
          innovation: s.innovation,
          technical: s.technical,
          impact: s.impact,
          presentation: s.presentation,
          total,
          comments: s.comments,
          submittedAt: s.submittedAt,
          judge: s.judge,
        };
      });

      const averageScore =
        mappedScores.length > 0 ? mappedScores.reduce((sum, s) => sum + s.total, 0) / mappedScores.length : 0;

      return {
        projectId: p.id,
        projectTitle: p.title,
        teamId: p.teamId,
        teamName: p.team.name,
        status: p.status,
        scores: mappedScores,
        averageScore: parseFloat(averageScore.toFixed(2)),
      };
    });
  }
}
