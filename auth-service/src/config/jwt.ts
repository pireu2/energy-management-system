import jwt, { SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET: string = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET: string =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || "15m";
const JWT_REFRESH_EXPIRES_IN: string | number =
  process.env.JWT_REFRESH_EXPIRES_IN || "7d";

export interface JWTPayload {
  id: number;
  email: string;
  role: string;
}

export class JWTService {
  static generateAccessToken(payload: JWTPayload): string {
    const options: SignOptions = {
      expiresIn: JWT_EXPIRES_IN as StringValue,
    };
    return jwt.sign(payload, JWT_SECRET, options);
  }

  static generateRefreshToken(payload: JWTPayload): string {
    const options: SignOptions = {
      expiresIn: JWT_REFRESH_EXPIRES_IN as StringValue,
    };
    return jwt.sign(payload, JWT_REFRESH_SECRET, options);
  }

  static verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  }

  static verifyRefreshToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  }

  static generateTokenPair(payload: JWTPayload) {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }
}
