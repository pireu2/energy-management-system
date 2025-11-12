import express from "express";
import cors from "cors";
import { testConnection } from "./config/database";
import { connectRabbitMQ } from "./config/rabbitmq";
import { startDeviceDataConsumer } from "./consumers/deviceDataConsumer";
import { startSyncConsumer } from "./consumers/syncConsumer";
import monitoringRoutes from "./routes/monitoringRoutes";

const app = express();
const PORT = process.env.PORT || 3005;

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
  });
});

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error("Database connection failed");
    }

    // Connect to RabbitMQ and start consumers
    const channel = await connectRabbitMQ();
    await startDeviceDataConsumer(channel);
    await startSyncConsumer(channel);

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✓ Monitoring service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing server");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT signal received: closing server");
  process.exit(0);
});

startServer();
