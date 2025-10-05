import { Router } from "express";
import { DeviceController } from "../controllers/DeviceController";

const router = Router();
const deviceController = new DeviceController();

router.get("/", deviceController.getAllDevices.bind(deviceController));
router.get(
  "/unassigned",
  deviceController.getUnassignedDevices.bind(deviceController)
);
router.get("/:id", deviceController.getDeviceById.bind(deviceController));
router.post("/", deviceController.createDevice.bind(deviceController));
router.put("/:id", deviceController.updateDevice.bind(deviceController));
router.delete("/:id", deviceController.deleteDevice.bind(deviceController));

router.post(
  "/:deviceId/assign/:userId",
  deviceController.assignDeviceToUser.bind(deviceController)
);
router.delete(
  "/:deviceId/assign",
  deviceController.unassignDeviceFromUser.bind(deviceController)
);

router.get(
  "/user/:userId",
  deviceController.getDevicesByUserId.bind(deviceController)
);

router.post("/sync/user", deviceController.syncUser.bind(deviceController));
router.get(
  "/sync/users",
  deviceController.getMirroredUsers.bind(deviceController)
);
router.delete(
  "/sync/user/:id",
  deviceController.deleteMirroredUser.bind(deviceController)
);

export default router;
