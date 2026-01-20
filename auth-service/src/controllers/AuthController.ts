import { Request, Response } from "express";
import { AuthRepository } from "../models/AuthRepository";
import { JWTService } from "../config/jwt";
import {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  AuthResponse,
} from "../models/AuthCredential";

const authRepository = new AuthRepository();
const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://localhost:3001";

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password }: LoginRequest = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      const credential = await authRepository.findByEmail(email);
      if (!credential) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValidPassword = await authRepository.validatePassword(
        credential,
        password
      );

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const userResponse = await fetch(
        `${USER_SERVICE_URL}/users/email/${email}`
      );
      if (!userResponse.ok) {
        if (userResponse.status === 404) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
        throw new Error(`User service error: ${userResponse.status}`);
      }
      const user = await userResponse.json();

      const tokens = JWTService.generateTokenPair({
        id: credential.id,
        email: credential.email,
        role: user.role,
      });

      await authRepository.updateRefreshToken(email, tokens.refreshToken);

      const response: AuthResponse = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };

      res.json(response);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async register(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName, role }: RegisterRequest =
        req.body;

      if (!email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({
          error:
            "All fields are required: email, password, firstName, lastName, role",
        });
      }

      const existingCredential = await authRepository.findByEmail(email);
      if (existingCredential) {
        return res.status(409).json({ error: "User already exists" });
      }

      const userProfileResponse = await fetch(`${USER_SERVICE_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          role,
        }),
      });

      if (!userProfileResponse.ok) {
        if (userProfileResponse.status === 409) {
          return res.status(409).json({ error: "User profile already exists" });
        }
        throw new Error(`User service error: ${userProfileResponse.status}`);
      }

      const userProfile = await userProfileResponse.json();

      const credential = await authRepository.create(email, password);

      const tokens = JWTService.generateTokenPair({
        id: credential.id,
        email: credential.email,
        role: role,
      });

      await authRepository.updateRefreshToken(email, tokens.refreshToken);

      const response: AuthResponse = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: userProfile.id,
          email: email,
          role: role,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }

      let payload;
      try {
        payload = JWTService.verifyRefreshToken(refreshToken);
      } catch (error) {
        return res.status(401).json({ error: "Invalid refresh token" });
      }

      const credential = await authRepository.findByRefreshToken(refreshToken);
      if (!credential) {
        return res.status(401).json({ error: "Invalid refresh token" });
      }

      const tokens = JWTService.generateTokenPair({
        id: payload.id,
        email: payload.email,
        role: payload.role,
      });

      await authRepository.updateRefreshToken(
        credential.email,
        tokens.refreshToken
      );

      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }

      const credential = await authRepository.findByRefreshToken(refreshToken);
      if (credential) {
        await authRepository.revokeRefreshToken(credential.email);
      }

      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async validateToken(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }

      const token = authHeader.substring(7);
      const payload = JWTService.verifyAccessToken(token);

      res.json({ valid: true, user: payload });
    } catch (error) {
      res.status(401).json({ error: "Invalid token" });
    }
  }
}
