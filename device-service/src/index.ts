import "reflect-metadata";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { AppDataSource } from "./config/database";
import deviceRoutes from "./routes/deviceRoutes";
import { consumeSyncEvents } from "./config/rabbitmq";
import { MirroredUserRepository } from "./models/MirroredUserRepository";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const mirroredUserRepository = new MirroredUserRepository();

// CORS is handled by API Gateway (nginx)
app.use(express.json());

app.use("/devices", deviceRoutes);

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "OK", service: "Device Service" });
});

const startServer = async () => {
  try {
    await AppDataSource.initialize();

    consumeSyncEvents(async (type, data) => {
      if (
        type === "user_created" ||
        type === "user_updated" ||
        type === "user_deleted"
      ) {
        try {
          if (type === "user_created" || type === "user_updated") {
            await mirroredUserRepository.syncFromUserService(data);
          } else if (type === "user_deleted") {
            await mirroredUserRepository.delete(data.id);
          }
        } catch (error) {
          console.error(`Error handling sync event ${type}:`, error);
          throw error;
        }
      }
    });

    app.listen(PORT, () => {
      console.log(`Device service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start device service:", error);
    process.exit(1);
  }
};

startServer();
