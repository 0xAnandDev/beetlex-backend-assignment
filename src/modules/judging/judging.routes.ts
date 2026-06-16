import { FastifyInstance } from "fastify";
import { JudgingController } from "./judging.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/role.middleware";
import { UserRole } from "@prisma/client";
import {
  projectIdParamSchema,
  eventIdParamSchema,
  trackQuerySchema,
  scoreBodySchema,
  updateScoreBodySchema,
} from "./judging.validation";

export async function judgingRoutes(fastify: FastifyInstance) {
  // Judge endpoints
  fastify.get(
    "/judge/projects",
    {
      preHandler: [authenticate, authorize([UserRole.judge, UserRole.admin]), validate(trackQuerySchema)],
    },
    JudgingController.findAssignedProjects
  );

  fastify.get(
    "/judge/projects/:projectId",
    {
      preHandler: [authenticate, authorize([UserRole.judge, UserRole.admin]), validate(projectIdParamSchema)],
    },
    JudgingController.getProjectWithMyScore
  );

  fastify.post(
    "/judge/projects/:projectId/score",
    {
      preHandler: [
        authenticate,
        authorize([UserRole.judge, UserRole.admin]),
        validate(projectIdParamSchema),
        validate(scoreBodySchema),
      ],
    },
    JudgingController.createScore
  );

  fastify.patch(
    "/judge/projects/:projectId/score",
    {
      preHandler: [
        authenticate,
        authorize([UserRole.judge, UserRole.admin]),
        validate(projectIdParamSchema),
        validate(updateScoreBodySchema),
      ],
    },
    JudgingController.updateScore
  );

  // Organizer endpoints
  fastify.get(
    "/events/:eventId/scores",
    {
      preHandler: [authenticate, authorize([UserRole.organizer, UserRole.admin]), validate(eventIdParamSchema)],
    },
    JudgingController.getEventScores
  );
}
