import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/errors";
import { ProjectStatus } from "@prisma/client";

export class LeaderboardService {
  static async getLeaderboard(eventId: string, userId: string, userRole: string) {
    // Step 1: Validate event
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new AppError("Event not found", 404, "NOT_FOUND_ERROR");
    }

    // Step 2: Authorization
    const isOrganizerOrAdmin = userRole === "admin" || event.organizerId === userId;
    if (!isOrganizerOrAdmin) {
      if (event.status !== "closed") {
        throw new AppError("Leaderboard is not available yet", 403, "FORBIDDEN_ERROR");
      }
    }

    // Step 3: Fetch data
    const projects = await prisma.project.findMany({
      where: {
        eventId,
        status: { not: ProjectStatus.draft },
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

    // Step 4: Compute per project
    const projectsWithAverages = projects.map((project) => {
      let averageScore = 0;
      const scoresWithTotal = project.scores.map((score) => {
        const total = (score.innovation + score.technical + score.impact + score.presentation) / 4;
        return {
          id: score.id,
          judgeId: score.judgeId,
          innovation: score.innovation,
          technical: score.technical,
          impact: score.impact,
          presentation: score.presentation,
          comments: score.comments,
          submittedAt: score.submittedAt,
          judge: score.judge,
          total,
        };
      });

      if (scoresWithTotal.length > 0) {
        const totalSum = scoresWithTotal.reduce((sum, s) => sum + s.total, 0);
        averageScore = totalSum / scoresWithTotal.length;
      }

      return {
        projectId: project.id,
        projectTitle: project.title,
        teamName: project.team.name,
        averageScore: parseFloat(averageScore.toFixed(2)),
        submittedAt: project.submittedAt,
        scores: scoresWithTotal,
      };
    });

    // Step 5: Sort
    // primary: averageScore DESC
    // secondary: submittedAt ASC (earlier wins)
    projectsWithAverages.sort((a, b) => {
      if (b.averageScore !== a.averageScore) {
        return b.averageScore - a.averageScore;
      }
      const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : Infinity;
      const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : Infinity;
      return timeA - timeB;
    });

    // Step 6: Rank assignment (1-based rank)
    return projectsWithAverages.map((p, index) => {
      const { submittedAt, ...rest } = p;
      return {
        rank: index + 1,
        ...rest,
      };
    });
  }
}
