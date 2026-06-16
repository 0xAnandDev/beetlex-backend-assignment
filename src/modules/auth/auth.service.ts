import { prisma } from "../../config/prisma";
import { hashPassword, comparePassword } from "../../utils/hash";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { AppError } from "../../utils/errors";
import { UserRole } from "@prisma/client";

export class AuthService {
  static async register(data: any) {
    const { email, username, password, fullName, avatarUrl, bio, githubUrl, linkedinUrl } = data;

    // Check if email or username already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new AppError("Email is already registered", 409, "CONFLICT_ERROR");
      }
      throw new AppError("Username is already taken", 409, "CONFLICT_ERROR");
    }

    const passwordHash = await hashPassword(password);

    // Explicitly enforce role as 'participant' during registration
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        fullName,
        role: UserRole.participant,
        avatarUrl: avatarUrl || null,
        bio: bio || null,
        githubUrl: githubUrl || null,
        linkedinUrl: linkedinUrl || null,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async login(data: any) {
    const { email, username, password } = data;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          email ? { email } : {},
          username ? { username } : {},
        ].filter((cond) => Object.keys(cond).length > 0),
      },
    });

    if (!user) {
      throw new AppError("Invalid email/username or password", 401, "UNAUTHORIZED_ERROR");
    }

    if (!user.isActive) {
      throw new AppError("Your account has been deactivated", 403, "FORBIDDEN_ERROR");
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError("Invalid email/username or password", 401, "UNAUTHORIZED_ERROR");
    }

    // Generate tokens
    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    // Store refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  static async refresh(token: string) {
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (error) {
      // If verification failed (e.g. invalid signature), try to revoke in DB if it exists
      const dbToken = await prisma.refreshToken.findUnique({
        where: { token },
      });
      if (dbToken && !dbToken.revoked) {
        await prisma.refreshToken.update({
          where: { id: dbToken.id },
          data: { revoked: true },
        });
      }
      throw new AppError("Invalid or expired refresh token", 401, "UNAUTHORIZED_ERROR");
    }

    // Lookup token in DB
    const dbToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!dbToken) {
      throw new AppError("Refresh token not found", 401, "UNAUTHORIZED_ERROR");
    }

    // Token reuse detection (part of token rotation mechanism)
    if (dbToken.revoked) {
      // If token is already revoked, it suggests token reuse/theft.
      // Revoke ALL active sessions for this user.
      await prisma.refreshToken.updateMany({
        where: { userId: dbToken.userId },
        data: { revoked: true },
      });
      throw new AppError("Security violation: Refresh token already used. All sessions revoked.", 401, "REVOKED_TOKEN_ERROR");
    }

    if (dbToken.expiresAt < new Date()) {
      // Token expired in DB, mark it as revoked and throw
      await prisma.refreshToken.update({
        where: { id: dbToken.id },
        data: { revoked: true },
      });
      throw new AppError("Refresh token has expired", 401, "UNAUTHORIZED_ERROR");
    }

    if (!dbToken.user.isActive) {
      throw new AppError("User account is deactivated", 403, "FORBIDDEN_ERROR");
    }

    // Revoke the old token (rotate it)
    await prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { revoked: true },
    });

    // Generate new access and refresh tokens
    const newAccessToken = signAccessToken({ userId: dbToken.user.id, role: dbToken.user.role });
    const newRefreshToken = signRefreshToken({ userId: dbToken.user.id });

    // Store new refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: dbToken.user.id,
        expiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(token: string) {
    const dbToken = await prisma.refreshToken.findUnique({
      where: { token },
    });

    if (dbToken) {
      // Invalidate the token in the DB
      await prisma.refreshToken.update({
        where: { id: dbToken.id },
        data: { revoked: true },
      });
    }
  }

  static async updateProfile(userId: string, data: any) {
    const updateData: any = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl || null;
    if (data.githubUrl !== undefined) updateData.githubUrl = data.githubUrl || null;
    if (data.linkedinUrl !== undefined) updateData.linkedinUrl = data.linkedinUrl || null;

    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }
}
