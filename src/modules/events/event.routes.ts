import { FastifyInstance } from "fastify";
import { EventController } from "./event.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/role.middleware";
import { UserRole } from "@prisma/client";
import { createEventSchema, updateEventSchema, queryEventSchema, getEventParamsSchema } from "./event.validation";

export async function eventRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/",
    {
      preHandler: [
        authenticate,
        authorize([UserRole.organizer, UserRole.admin]),
        validate(createEventSchema),
      ],
    },
    EventController.create
  );

  fastify.get(
    "/",
    {
      preHandler: [validate(queryEventSchema)],
    },
    EventController.findAll
  );

  fastify.get(
    "/:id",
    {
      preHandler: [validate(getEventParamsSchema)],
    },
    EventController.findById
  );

  fastify.patch(
    "/:id",
    {
      preHandler: [
        authenticate,
        authorize([UserRole.organizer, UserRole.admin]),
        validate(getEventParamsSchema),
        validate(updateEventSchema),
      ],
    },
    EventController.update
  );

  fastify.delete(
    "/:id",
    {
      preHandler: [
        authenticate,
        authorize([UserRole.organizer, UserRole.admin]),
        validate(getEventParamsSchema),
      ],
    },
    EventController.delete
  );
}
