import express from "express";
import cors from "cors";
import { testConnection } from "./config/database";
import { connectRabbitMQ, getDeviceId } from "./config/rabbitmq";
import {
  startDeviceDataConsumer,
  startMultiDeviceConsumers,
} from "./consumers/deviceDataConsumer";
import { startSyncConsumer } from "./consumers/syncConsumer";
import monitoringRoutes from "./routes/monitoringRoutes";

const app = express();
const PORT = process.env.PORT || 3005;
const DEVICE_SERVICE_URL =
  process.env.DEVICE_SERVICE_URL || "http://device-service:3003/devices";

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/monitoring", monitoringRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    service: "Monitoring Service",
    version: "1.0.0",
    status: "running",
    deviceId: getDeviceId() || "all",
  });
});

async function fetchDevices(): Promise<{ id: number; name: string }[]> {
  try {
    const response = await fetch(DEVICE_SERVICE_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.statusText}`);
    }
    return (await response.json()) as { id: number; name: string }[];
  } catch (error) {
    console.error("Error fetching devices:", error);
    return [];
  }
}

async function startServer() {
  try {
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error("Database connection failed");
    }

    const channel = await connectRabbitMQ();

    const deviceId = getDeviceId();

    if (deviceId > 0) {
      // Single device mode - consume from specific device queue
      await startDeviceDataConsumer(channel);
    } else {
      // Multi-device mode - create a consumer for each device
      console.log("Fetching devices to create consumers...");
      let devices: { id: number; name: string }[] = [];
      let retries = 0;
      const maxRetries = 10;

      while (devices.length === 0 && retries < maxRetries) {
        devices = await fetchDevices();
        if (devices.length === 0) {
          retries++;
          console.log(`Waiting for devices... (${retries}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      if (devices.length > 0) {
        await startMultiDeviceConsumers(
          channel,
          devices.map((d) => d.id)
        );
      } else {
        // Fallback to main queue if no devices found
        console.log("No devices found, consuming from main queue");
        await startDeviceDataConsumer(channel);
      }

      // Periodically check for new devices
      setInterval(async () => {
        const newDevices = await fetchDevices();
        if (newDevices.length > 0) {
          await startMultiDeviceConsumers(
            channel,
            newDevices.map((d) => d.id)
          );
        }
      }, 60000);
    }

    await startSyncConsumer(channel);

    app.listen(PORT, () => {
      console.log(`Monitoring service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  process.exit(0);
});

process.on("SIGINT", async () => {
  process.exit(0);
});

startServer();
