import { FastifyInstance } from "fastify";
import { RegistrationController } from "./registration.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/role.middleware";
import { UserRole } from "@prisma/client";
import { routeParamsSchema, registerBodySchema, queryRegistrationSchema } from "./registration.validation";

export async function registrationRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:id/register",
    {
      preHandler: [authenticate, validate(routeParamsSchema), validate(registerBodySchema)],
    },
    RegistrationController.register
  );

  fastify.get(
    "/:id/registration",
    {
      preHandler: [authenticate, validate(routeParamsSchema)],
    },
    RegistrationController.getRegistrationStatus
  );

  fastify.delete(
    "/:id/registration",
    {
      preHandler: [authenticate, validate(routeParamsSchema)],
    },
    RegistrationController.cancelRegistration
  );

  fastify.get(
    "/:id/registrations",
    {
      preHandler: [
        authenticate,
        authorize([UserRole.organizer, UserRole.admin]),
        validate(routeParamsSchema),
        validate(queryRegistrationSchema),
      ],
    },
    RegistrationController.findEventRegistrations
  );
}
