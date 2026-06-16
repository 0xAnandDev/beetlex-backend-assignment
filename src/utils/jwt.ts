import jwt from "jsonwebtoken";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access_secret_key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret_key";

export interface AccessTokenPayload {
  userId: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign({ ...payload }, JWT_ACCESS_SECRET, {
    expiresIn: (process.env.ACCESS_TOKEN_EXPIRES || "15m") as any,
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign({ ...payload }, JWT_REFRESH_SECRET, {
    expiresIn: (process.env.REFRESH_TOKEN_EXPIRES || "7d") as any,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
