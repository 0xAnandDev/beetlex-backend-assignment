import { FastifyRequest, FastifyReply } from "fastify";
import { UserRole } from "@prisma/client";
import { AppError } from "../utils/errors";

export function authorize(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED_ERROR");
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new AppError("You do not have permission to access this resource", 403, "FORBIDDEN_ERROR");
    }
  };
}
