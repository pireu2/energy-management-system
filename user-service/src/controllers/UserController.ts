import { Request, Response } from "express";
import { UserRepository } from "../models/UserRepository";

const userRepository = new UserRepository();

export class UserController {
  async getAllUsers(req: Request, res: Response) {
    try {
      const users = await userRepository.findAll();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getUserById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id || "");

      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const user = await userRepository.findById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getUserByEmail(req: Request, res: Response) {
    try {
      const email = req.params.email ?? "";

      if (!email) {
        return res.status(400).json({ error: "Email parameter is required" });
      }

      const user = await userRepository.findByEmail(email);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user by email:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async createUser(req: Request, res: Response) {
    try {
      const { email, firstName, lastName, role } = req.body;

      if (!email || !firstName || !lastName || !role) {
        return res.status(400).json({
          error: "Missing required fields: email, firstName, lastName, role",
        });
      }

      if (!["admin", "client"].includes(role)) {
        return res.status(400).json({
          error: 'Role must be either "admin" or "client"',
        });
      }

      const existingUser = await userRepository.findByEmail(email);
      if (existingUser) {
        return res
          .status(409)
          .json({ error: "User already exists with this email" });
      }

      const user = await userRepository.create({
        email,
        firstName,
        lastName,
        role,
      });

      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id || "");
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const { firstName, lastName, role } = req.body;

      if (role && !["admin", "client"].includes(role)) {
        return res.status(400).json({
          error: 'Role must be either "admin" or "client"',
        });
      }

      const user = await userRepository.update(id, {
        firstName,
        lastName,
        role,
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id || "");

      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const deleted = await userRepository.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
