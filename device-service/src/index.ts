import "reflect-metadata";
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AppDataSource } from "./config/database";
import deviceRoutes from "./routes/deviceRoutes";
import { consumeSyncEvents } from "./config/rabbitmq";
import { MirroredUserRepository } from "./models/MirroredUserRepository";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const mirroredUserRepository = new MirroredUserRepository();

app.use(cors());
app.use(express.json());

app.use("/devices", deviceRoutes);

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "OK", service: "Device Service" });
});

const startServer = async () => {
  try {
    await AppDataSource.initialize();
    console.log("Device service database initialized successfully");

    // Start RabbitMQ sync consumer
    consumeSyncEvents(async (type, data) => {
      try {
        if (type === "user_created" || type === "user_updated") {
          await mirroredUserRepository.syncFromUserService(data);
          console.log(`Synced user ${data.id} via RabbitMQ`);
        } else if (type === "user_deleted") {
          await mirroredUserRepository.delete(data.id);
          console.log(`Deleted user ${data.id} via RabbitMQ`);
        }
      } catch (error) {
        console.error(`Error handling sync event ${type}:`, error);
      }
    });

    app.listen(PORT, () => {
      console.log(`Device service running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Devices API: http://localhost:${PORT}/devices`);
    });
  } catch (error) {
    console.error("Failed to start device service:", error);
    process.exit(1);
  }
};

startServer();
