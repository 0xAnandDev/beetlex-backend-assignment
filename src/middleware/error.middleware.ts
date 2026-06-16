import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
import { errorResponse } from "../utils/response";
import { Prisma } from "@prisma/client";

export function errorHandler(
  error: FastifyError | ZodError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error(error);

  // 1. Zod Validation Error
  if (error instanceof ZodError) {
    const details = error.issues.map((err) => ({
      path: err.path.join("."),
      message: err.message,
    }));
    return reply.status(400).send(errorResponse("Validation failed", "VALIDATION_ERROR", details));
  }

  // 2. Custom App Error
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code, error.details));
  }

  // 3. Prisma Client Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation (e.g., email / username already exists)
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[]) || [];
      const fields = target.join(", ");
      return reply
        .status(409)
        .send(errorResponse(`Record already exists with this ${fields || "unique value"}`, "CONFLICT_ERROR"));
    }
    // Record not found
    if (error.code === "P2025") {
      return reply.status(404).send(errorResponse(error.message || "Record not found", "NOT_FOUND_ERROR"));
    }
  }

  // 4. Fastify Errors (e.g., body parsing, invalid JSON)
  const statusCode = (error as FastifyError).statusCode || 500;
  const errorCode =
    statusCode === 401
      ? "UNAUTHORIZED_ERROR"
      : statusCode === 403
      ? "FORBIDDEN_ERROR"
      : "INTERNAL_SERVER_ERROR";
  const message = statusCode === 500 ? "Internal server error" : error.message;

  return reply.status(statusCode).send(errorResponse(message, errorCode));
}
