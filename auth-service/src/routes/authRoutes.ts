import { Router } from "express";
import { AuthController } from "../controllers/AuthController";

const router = Router();
const authController = new AuthController();

router.post("/login", authController.login.bind(authController));

router.post("/register", authController.register.bind(authController));

router.post("/refresh", authController.refreshToken.bind(authController));

router.post("/logout", authController.logout.bind(authController));

router.get("/validate", authController.validateToken.bind(authController));

export default router;
