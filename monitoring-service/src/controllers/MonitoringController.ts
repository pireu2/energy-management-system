import { Request, Response } from "express";
import { MeasurementRepository } from "../models/MeasurementRepository";

const measurementRepository = new MeasurementRepository();

export class MonitoringController {
  async getUserHourlyConsumption(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.userId);
      const date = req.query.date as string;

      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      if (!date) {
        return res.status(400).json({ error: "Date parameter is required" });
      }

      const queryDate = new Date(date);
      if (isNaN(queryDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const data =
        await measurementRepository.getHourlyConsumptionByUserAndDate(
          userId,
          queryDate
        );

      res.json(data);
    } catch (error) {
      console.error("Error fetching user hourly consumption:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getDeviceHourlyConsumption(req: Request, res: Response) {
    try {
      const deviceId = parseInt(req.params.deviceId);
      const date = req.query.date as string;

      if (isNaN(deviceId)) {
        return res.status(400).json({ error: "Invalid device ID" });
      }

      if (!date) {
        return res.status(400).json({ error: "Date parameter is required" });
      }

      const queryDate = new Date(date);
      if (isNaN(queryDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const data =
        await measurementRepository.getHourlyConsumptionByDeviceAndDate(
          deviceId,
          queryDate
        );

      res.json(data);
    } catch (error) {
      console.error("Error fetching device hourly consumption:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async healthCheck(req: Request, res: Response) {
    res.json({ status: "ok", service: "monitoring-service" });
  }
}
