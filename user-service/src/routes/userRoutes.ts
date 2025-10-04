import { Router } from "express";
import { UserController } from "../controllers/UserController";

const router = Router();
const userController = new UserController();

router.get("/", userController.getAllUsers.bind(userController));

router.get("/:id", userController.getUserById.bind(userController));

router.get("/email/:email", userController.getUserByEmail.bind(userController));

router.post("/", userController.createUser.bind(userController));

router.put("/:id", userController.updateUser.bind(userController));

router.delete("/:id", userController.deleteUser.bind(userController));

export default router;
