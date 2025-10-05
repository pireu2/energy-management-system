import { Request, Response } from "express";
import { DeviceRepository } from "../models/DeviceRepository";
import { MirroredUserRepository } from "../models/MirroredUserRepository";

const deviceRepository = new DeviceRepository();
const mirroredUserRepository = new MirroredUserRepository();

export class DeviceController {
  async getAllDevices(req: Request, res: Response) {
    try {
      const devices = await deviceRepository.findAll();
      res.json(devices);
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getDeviceById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id || "");
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid device ID" });
      }

      const device = await deviceRepository.findById(id);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      res.json(device);
    } catch (error) {
      console.error("Error fetching device:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getDevicesByUserId(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.userId || "");
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const devices = await deviceRepository.findByUserId(userId);
      res.json(devices);
    } catch (error) {
      console.error("Error fetching devices by user ID:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getUnassignedDevices(req: Request, res: Response) {
    try {
      const devices = await deviceRepository.findUnassigned();
      res.json(devices);
    } catch (error) {
      console.error("Error fetching unassigned devices:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async createDevice(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        maximumConsumption,
        deviceType,
        location,
        assignedUserId,
      } = req.body;

      if (!name || !maximumConsumption) {
        return res.status(400).json({
          error: "Missing required fields: name, maximumConsumption",
        });
      }

      if (maximumConsumption <= 0) {
        return res.status(400).json({
          error: "Maximum consumption must be greater than 0",
        });
      }

      if (assignedUserId) {
        const user = await mirroredUserRepository.findById(assignedUserId);
        if (!user) {
          return res.status(400).json({
            error: "Assigned user not found. User must exist in the system.",
          });
        }
      }

      const device = await deviceRepository.create({
        name,
        description,
        maximumConsumption: Number(maximumConsumption),
        deviceType: deviceType || "smart_meter",
        location,
        assignedUserId,
      });

      res.status(201).json(device);
    } catch (error) {
      console.error("Error creating device:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateDevice(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id || "");
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid device ID" });
      }

      const {
        name,
        description,
        maximumConsumption,
        deviceType,
        location,
        assignedUserId,
        isActive,
      } = req.body;

      if (maximumConsumption !== undefined && maximumConsumption <= 0) {
        return res.status(400).json({
          error: "Maximum consumption must be greater than 0",
        });
      }

      if (assignedUserId) {
        const user = await mirroredUserRepository.findById(assignedUserId);
        if (!user) {
          return res.status(400).json({
            error: "Assigned user not found. User must exist in the system.",
          });
        }
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (maximumConsumption !== undefined)
        updateData.maximumConsumption = Number(maximumConsumption);
      if (deviceType !== undefined) updateData.deviceType = deviceType;
      if (location !== undefined) updateData.location = location;
      if (assignedUserId !== undefined)
        updateData.assignedUserId = assignedUserId;
      if (isActive !== undefined) updateData.isActive = isActive;

      const device = await deviceRepository.update(id, updateData);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      res.json(device);
    } catch (error) {
      console.error("Error updating device:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async deleteDevice(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id || "");
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid device ID" });
      }

      const deleted = await deviceRepository.delete(id);
      if (!deleted) {
        return res.status(404).json({ error: "Device not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting device:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async assignDeviceToUser(req: Request, res: Response) {
    try {
      const deviceId = parseInt(req.params.deviceId || "");
      const userId = parseInt(req.params.userId || "");

      if (isNaN(deviceId) || isNaN(userId)) {
        return res.status(400).json({ error: "Invalid device ID or user ID" });
      }

      const user = await mirroredUserRepository.findById(userId);
      if (!user) {
        return res.status(400).json({
          error: "User not found. User must exist in the system.",
        });
      }

      const device = await deviceRepository.assignToUser(deviceId, userId);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      res.json(device);
    } catch (error) {
      console.error("Error assigning device to user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async unassignDeviceFromUser(req: Request, res: Response) {
    try {
      const deviceId = parseInt(req.params.deviceId || "");
      if (isNaN(deviceId)) {
        return res.status(400).json({ error: "Invalid device ID" });
      }

      const device = await deviceRepository.unassignFromUser(deviceId);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      res.json(device);
    } catch (error) {
      console.error("Error unassigning device from user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async syncUser(req: Request, res: Response) {
    try {
      const userData = req.body;

      if (!userData.id || !userData.email) {
        return res.status(400).json({
          error: "Missing required user fields: id, email",
        });
      }

      const mirroredUser = await mirroredUserRepository.syncFromUserService(
        userData
      );
      res.json(mirroredUser);
    } catch (error) {
      console.error("Error syncing user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getMirroredUsers(req: Request, res: Response) {
    try {
      const users = await mirroredUserRepository.findAll();
      res.json(users);
    } catch (error) {
      console.error("Error fetching mirrored users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async deleteMirroredUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id || "");
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const existing = await mirroredUserRepository.findById(id);
      if (!existing) {
        return res.status(404).json({ error: "Mirrored user not found" });
      }

      await deviceRepository.unassignAllFromUser(id);

      const deleted = await mirroredUserRepository.delete(id);
      if (!deleted) {
        return res.status(404).json({ error: "Mirrored user not found" });
      }

      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting mirrored user:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
