import { FastifyInstance } from "fastify";
import { ProjectController } from "./project.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import {
  teamIdParamSchema,
  eventIdParamSchema,
  createProjectSchema,
  updateProjectSchema,
  uploadDeckSchema,
} from "./project.validation";

export async function projectRoutes(fastify: FastifyInstance) {
  // Team project endpoints
  fastify.post(
    "/teams/:teamId/project",
    {
      preHandler: [authenticate, validate(teamIdParamSchema), validate(createProjectSchema)],
    },
    ProjectController.createDraft
  );

  fastify.get(
    "/teams/:teamId/project",
    {
      preHandler: [authenticate, validate(teamIdParamSchema)],
    },
    ProjectController.getProjectByTeam
  );

  fastify.patch(
    "/teams/:teamId/project",
    {
      preHandler: [authenticate, validate(teamIdParamSchema), validate(updateProjectSchema)],
    },
    ProjectController.updateDraft
  );

  fastify.post(
    "/teams/:teamId/project/submit",
    {
      preHandler: [authenticate, validate(teamIdParamSchema)],
    },
    ProjectController.submitProject
  );

  fastify.post(
    "/teams/:teamId/project/deck",
    {
      preHandler: [authenticate, validate(teamIdParamSchema), validate(uploadDeckSchema)],
    },
    ProjectController.uploadDeck
  );

  // Event projects endpoints
  fastify.get(
    "/events/:eventId/projects",
    {
      preHandler: [authenticate, validate(eventIdParamSchema)],
    },
    ProjectController.findAllForEvent
  );
}
