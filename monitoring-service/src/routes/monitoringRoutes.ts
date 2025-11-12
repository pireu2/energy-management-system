import { Router } from "express";
import { MonitoringController } from "../controllers/MonitoringController";

const router = Router();
const controller = new MonitoringController();

router.get("/health", controller.healthCheck.bind(controller));

router.get(
  "/users/:userId/consumption",
  controller.getUserHourlyConsumption.bind(controller)
);

router.get(
  "/devices/:deviceId/consumption",
  controller.getDeviceHourlyConsumption.bind(controller)
);

export default router;
