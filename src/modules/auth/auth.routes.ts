import { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { registerSchema, loginSchema, updateMeSchema } from "./auth.validation";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/register", { preHandler: validate(registerSchema) }, AuthController.register);
  fastify.post("/login", { preHandler: validate(loginSchema) }, AuthController.login);
  fastify.post("/refresh", AuthController.refresh);
  fastify.post("/logout", AuthController.logout);
  fastify.get("/me", { preHandler: [authenticate] }, AuthController.me);
  fastify.patch("/me", { preHandler: [authenticate, validate(updateMeSchema)] }, AuthController.updateMe);
}
