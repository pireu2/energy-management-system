import express, { Request, Response } from "express";
import cors from "cors";
import { exec } from "child_process";
import { promisify } from "util";
import {
  connectRabbitMQ,
  QUEUES,
  assertIngestQueue,
  publishToIngestQueue,
} from "./config/rabbitmq";

const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

const DEVICE_SERVICE_URL =
  process.env.DEVICE_SERVICE_URL || "http://device-service:3003/devices";
const DOCKER_NETWORK =
  process.env.DOCKER_NETWORK || "assignment1_energy-network";
const MONITORING_IMAGE =
  process.env.MONITORING_IMAGE || "assignment1-monitoring-service";
const ENABLE_CONTAINER_SCALING =
  process.env.ENABLE_CONTAINER_SCALING === "true";

interface Device {
  id: number;
  name: string;
  maximumConsumption: number;
}

interface DeviceDataMessage {
  timestamp: string;
  device_id: number;
  measurement_value: number;
}

// Track device IDs and their queues
const deviceQueues = new Map<number, boolean>();
const messageStats = new Map<number, number>();
const runningContainers = new Map<number, string>();

async function fetchDevices(): Promise<Device[]> {
  try {
    const response = await fetch(DEVICE_SERVICE_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.statusText}`);
    }
    return (await response.json()) as Device[];
  } catch (error) {
    console.error("Error fetching devices:", error);
    return [];
  }
}

async function spawnMonitoringContainer(deviceId: number): Promise<boolean> {
  if (!ENABLE_CONTAINER_SCALING) {
    return false;
  }

  const containerName = `energy-monitoring-device-${deviceId}`;

  // Check if container already exists
  if (runningContainers.has(deviceId)) {
    return true;
  }

  try {
    // Remove existing container if it exists (stopped)
    await execAsync(`docker rm -f ${containerName} 2>/dev/null || true`);

    // Spawn new container for this device
    const cmd = `docker run -d \
      --name ${containerName} \
      --network ${DOCKER_NETWORK} \
      -e DB_HOST=energy-postgres-monitoring \
      -e DB_PORT=5432 \
      -e DB_NAME=monitoring_db \
      -e DB_USER=energy_user \
      -e DB_PASSWORD=energy_password \
      -e PORT=3005 \
      -e NODE_ENV=development \
      -e RABBITMQ_URL=amqp://energy_user:energy_password@rabbitmq:5672 \
      -e DEVICE_ID=${deviceId} \
      --restart unless-stopped \
      ${MONITORING_IMAGE}`;

    const { stdout } = await execAsync(cmd);
    const containerId = stdout.trim();
    runningContainers.set(deviceId, containerId);
    console.log(
      `Spawned monitoring container for device ${deviceId}: ${containerName}`
    );
    return true;
  } catch (error) {
    console.error(`Failed to spawn container for device ${deviceId}:`, error);
    return false;
  }
}

async function stopMonitoringContainer(deviceId: number): Promise<boolean> {
  const containerName = `energy-monitoring-device-${deviceId}`;

  try {
    await execAsync(`docker rm -f ${containerName}`);
    runningContainers.delete(deviceId);
    console.log(`Stopped monitoring container for device ${deviceId}`);
    return true;
  } catch (error) {
    console.error(`Failed to stop container for device ${deviceId}:`, error);
    return false;
  }
}

async function syncMonitoringContainers(): Promise<void> {
  if (!ENABLE_CONTAINER_SCALING) {
    return;
  }

  const devices = await fetchDevices();
  const currentDeviceIds = new Set(devices.map((d) => d.id));

  // Spawn containers for new devices
  for (const device of devices) {
    if (!runningContainers.has(device.id)) {
      await spawnMonitoringContainer(device.id);
    }
  }

  // Stop containers for removed devices
  for (const deviceId of runningContainers.keys()) {
    if (!currentDeviceIds.has(deviceId)) {
      await stopMonitoringContainer(deviceId);
    }
  }
}

async function initializeDeviceQueues(): Promise<void> {
  const devices = await fetchDevices();
  for (const device of devices) {
    if (!deviceQueues.has(device.id)) {
      await assertIngestQueue(device.id);
      deviceQueues.set(device.id, true);
      messageStats.set(device.id, 0);
      console.log(
        `Created ingest queue for device ${device.id}: ${device.name}`
      );

      // Spawn monitoring container for this device if scaling is enabled
      if (ENABLE_CONTAINER_SCALING) {
        await spawnMonitoringContainer(device.id);
      }
    }
  }
}

async function ensureDeviceQueue(deviceId: number): Promise<void> {
  if (!deviceQueues.has(deviceId)) {
    await assertIngestQueue(deviceId);
    deviceQueues.set(deviceId, true);
    messageStats.set(deviceId, 0);
    console.log(`Created new ingest queue for device ${deviceId}`);
  }
}

async function startConsumer(): Promise<void> {
  const channel = await connectRabbitMQ();
  await channel.prefetch(10);

  channel.consume(
    QUEUES.DEVICE_DATA,
    async (msg) => {
      if (!msg) return;

      try {
        const data: DeviceDataMessage = JSON.parse(msg.content.toString());

        // Ensure queue exists for this device
        await ensureDeviceQueue(data.device_id);

        // Route to device-specific queue
        const success = await publishToIngestQueue(data.device_id, data);

        if (success) {
          const count = messageStats.get(data.device_id) || 0;
          messageStats.set(data.device_id, count + 1);
          channel.ack(msg);
        } else {
          channel.nack(msg, false, true);
        }
      } catch (error) {
        console.error("Error processing device data:", error);
        channel.nack(msg, false, true);
      }
    },
    { noAck: false }
  );
}

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    service: "Load Balancer Service",
    deviceCount: deviceQueues.size,
    strategy: "device-based-routing",
    containerScaling: ENABLE_CONTAINER_SCALING,
    runningContainers: runningContainers.size,
  });
});

app.get("/stats", (req: Request, res: Response) => {
  const stats: Record<string, number> = {};
  for (const [deviceId, count] of messageStats) {
    stats[`device_${deviceId}`] = count;
  }
  res.json({
    deviceCount: deviceQueues.size,
    messageStats: stats,
    totalMessages: Array.from(messageStats.values()).reduce((a, b) => a + b, 0),
  });
});

app.post("/stats/reset", (req: Request, res: Response) => {
  for (const key of messageStats.keys()) {
    messageStats.set(key, 0);
  }
  res.json({ success: true, message: "Stats reset" });
});

app.post("/sync-devices", async (req: Request, res: Response) => {
  try {
    await initializeDeviceQueues();
    await syncMonitoringContainers();
    res.json({
      success: true,
      deviceCount: deviceQueues.size,
      runningContainers: runningContainers.size,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to sync devices" });
  }
});

app.get("/containers", (req: Request, res: Response) => {
  const containers = Array.from(runningContainers.entries()).map(
    ([deviceId, containerId]) => ({
      deviceId,
      containerId: containerId.substring(0, 12),
      containerName: `energy-monitoring-device-${deviceId}`,
    })
  );
  res.json({
    scalingEnabled: ENABLE_CONTAINER_SCALING,
    containers,
    count: containers.length,
  });
});

app.get("/devices", async (req: Request, res: Response) => {
  try {
    const devices = await fetchDevices();
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

app.get("/queues", (req: Request, res: Response) => {
  const queues = Array.from(deviceQueues.keys()).map(
    (id) => `ingest_queue_${id}`
  );
  res.json({ queues, count: queues.length });
});

async function startServer() {
  try {
    console.log("Fetching initial devices...");
    console.log(
      `Container scaling: ${ENABLE_CONTAINER_SCALING ? "ENABLED" : "DISABLED"}`
    );

    let retries = 0;
    const maxRetries = 10;

    while (retries < maxRetries) {
      try {
        const devices = await fetchDevices();
        if (devices.length > 0) {
          console.log(`Found ${devices.length} devices`);
          break;
        }
      } catch {
        // Ignore errors during startup
      }
      retries++;
      console.log(`Waiting for device service... (${retries}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    await connectRabbitMQ();
    await initializeDeviceQueues();
    await startConsumer();

    // Periodically sync device queues and containers
    setInterval(async () => {
      await initializeDeviceQueues();
      await syncMonitoringContainers();
    }, 60000);

    const PORT = process.env.PORT || 3008;
    app.listen(PORT, () => {
      console.log(`Load Balancer service running on port ${PORT}`);
      console.log(
        `Strategy: device-based-routing, Devices: ${deviceQueues.size}`
      );
      if (ENABLE_CONTAINER_SCALING) {
        console.log(`Monitoring containers spawned: ${runningContainers.size}`);
      }
    });
  } catch (error) {
    console.error("Failed to start load balancer service:", error);
    process.exit(1);
  }
}

startServer();
