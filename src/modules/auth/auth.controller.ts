import { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import { successResponse } from "../../utils/response";
import { AppError } from "../../utils/errors";

const REFRESH_COOKIE_NAME = "refreshToken";

export class AuthController {
  static async register(request: FastifyRequest, reply: FastifyReply) {
    const user = await AuthService.register(request.body);
    return reply.status(201).send(successResponse(user, "User registered successfully"));
  }

  static async login(request: FastifyRequest, reply: FastifyReply) {
    const result = await AuthService.login(request.body);

    reply.setCookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return reply.status(200).send(
      successResponse(
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        "Login successful"
      )
    );
  }

  static async refresh(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new AppError("Refresh token missing from cookies", 401, "UNAUTHORIZED_ERROR");
    }

    const result = await AuthService.refresh(refreshToken);

    reply.setCookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return reply.status(200).send(
      successResponse(
        {
          accessToken: result.accessToken,
        },
        "Tokens refreshed successfully"
      )
    );
  }

  static async logout(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    reply.clearCookie(REFRESH_COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return reply.status(200).send(successResponse(null, "Logged out successfully"));
  }

  static async me(request: FastifyRequest, reply: FastifyReply) {
    const { passwordHash: _, ...userWithoutPassword } = request.user!;
    return reply.status(200).send(successResponse(userWithoutPassword, "User profile fetched successfully"));
  }

  static async updateMe(request: FastifyRequest, reply: FastifyReply) {
    const user = await AuthService.updateProfile(request.user!.id, request.body);
    return reply.status(200).send(successResponse(user, "Profile updated successfully"));
  }
}
