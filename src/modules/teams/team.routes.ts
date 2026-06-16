import { FastifyInstance } from "fastify";
import { TeamController } from "./team.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { eventIdParamSchema, eventAndTeamIdParamsSchema, createTeamSchema } from "./team.validation";

export async function teamRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:eventId/teams",
    {
      preHandler: [authenticate, validate(eventIdParamSchema), validate(createTeamSchema)],
    },
    TeamController.create
  );

  fastify.post(
    "/:eventId/teams/:teamId/join",
    {
      preHandler: [authenticate, validate(eventAndTeamIdParamsSchema)],
    },
    TeamController.join
  );

  fastify.delete(
    "/:eventId/teams/:teamId/leave",
    {
      preHandler: [authenticate, validate(eventAndTeamIdParamsSchema)],
    },
    TeamController.leave
  );

  fastify.get(
    "/:eventId/teams/:teamId",
    {
      preHandler: [validate(eventAndTeamIdParamsSchema)],
    },
    TeamController.findById
  );

  fastify.get(
    "/:eventId/teams",
    {
      preHandler: [validate(eventIdParamSchema)],
    },
    TeamController.findAll
  );
}
