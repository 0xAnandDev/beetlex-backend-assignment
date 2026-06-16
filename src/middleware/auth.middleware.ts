import { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../utils/jwt";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { User } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authorization header missing or invalid format", 401, "UNAUTHORIZED_ERROR");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new AppError("Bearer token missing", 401, "UNAUTHORIZED_ERROR");
    }

    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new AppError("User not found or inactive", 401, "UNAUTHORIZED_ERROR");
    }

    if (!user.isActive) {
      throw new AppError("User account is deactivated", 403, "FORBIDDEN_ERROR");
    }

    request.user = user;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error.name === "TokenExpiredError") {
      throw new AppError("Access token has expired", 401, "TOKEN_EXPIRED_ERROR");
    }
    if (error.name === "JsonWebTokenError") {
      throw new AppError("Invalid access token", 401, "UNAUTHORIZED_ERROR");
    }
    throw new AppError(error.message || "Authentication failed", 401, "UNAUTHORIZED_ERROR");
  }
}
