import * as amqp from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://energy_user:energy_password@localhost:5672";
const DEVICE_SERVICE_URL =
  process.env.DEVICE_SERVICE_URL || "http://localhost:3003/devices";
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || "10000");
const QUEUE_NAME = "device_data_queue";

interface Device {
  id: number;
  name: string;
  maximumConsumption: number;
}

interface DeviceSimulator {
  device: Device;
  baseLoad: number;
  maxVariation: number;
  intervalId?: NodeJS.Timeout;
}

interface TimePattern {
  hour: number;
  multiplier: number;
}

const TIME_PATTERNS: TimePattern[] = [
  { hour: 0, multiplier: 0.5 },
  { hour: 1, multiplier: 0.4 },
  { hour: 2, multiplier: 0.4 },
  { hour: 3, multiplier: 0.4 },
  { hour: 4, multiplier: 0.4 },
  { hour: 5, multiplier: 0.5 },
  { hour: 6, multiplier: 0.8 },
  { hour: 7, multiplier: 1.2 },
  { hour: 8, multiplier: 1.3 },
  { hour: 9, multiplier: 1.1 },
  { hour: 10, multiplier: 1.0 },
  { hour: 11, multiplier: 1.1 },
  { hour: 12, multiplier: 1.3 },
  { hour: 13, multiplier: 1.2 },
  { hour: 14, multiplier: 1.0 },
  { hour: 15, multiplier: 1.0 },
  { hour: 16, multiplier: 1.1 },
  { hour: 17, multiplier: 1.3 },
  { hour: 18, multiplier: 1.5 },
  { hour: 19, multiplier: 1.6 },
  { hour: 20, multiplier: 1.5 },
  { hour: 21, multiplier: 1.3 },
  { hour: 22, multiplier: 1.0 },
  { hour: 23, multiplier: 0.7 },
];

const activeSimulators = new Map<number, DeviceSimulator>();

async function fetchDevices(): Promise<Device[]> {
  try {
    const response = await fetch(DEVICE_SERVICE_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.statusText}`);
    }
    const devices = (await response.json()) as Device[];
    return devices.filter((d) => d.id);
  } catch (error) {
    console.error("Error fetching devices:", error);
    return [];
  }
}

function getTimeMultiplier(hour: number): number {
  const pattern = TIME_PATTERNS.find((p) => p.hour === hour);
  return pattern ? pattern.multiplier : 1.0;
}

function generateMeasurement(simulator: DeviceSimulator): number {
  const now = new Date();
  const hour = now.getHours();
  const timeMultiplier = getTimeMultiplier(hour);
  const randomVariation = (Math.random() - 0.5) * 2 * simulator.maxVariation;
  const measurement = simulator.baseLoad * timeMultiplier + randomVariation;

  // Allow measurements to exceed maximum consumption to trigger overconsumption alerts
  // Only ensure the value is non-negative
  return Math.max(0, Number(measurement.toFixed(3)));
}

function createDeviceSimulator(device: Device): DeviceSimulator {
  const avgConsumptionRatio = 0.4 + Math.random() * 0.2;
  const baseLoad = device.maximumConsumption * avgConsumptionRatio;
  const maxVariation = baseLoad * 0.3;

  return {
    device,
    baseLoad,
    maxVariation,
  };
}

function startDeviceSimulator(
  simulator: DeviceSimulator,
  channel: amqp.Channel
): void {
  const sendMeasurement = () => {
    const timestamp = new Date().toISOString();
    const measurementValue = generateMeasurement(simulator);

    const message = {
      timestamp,
      device_id: simulator.device.id,
      measurement_value: measurementValue,
    };

    const content = Buffer.from(JSON.stringify(message));
    channel.sendToQueue(QUEUE_NAME, content, { persistent: true });

    console.log(
      `[${timestamp}] Device ${simulator.device.id} (${
        simulator.device.name
      }): ${measurementValue.toFixed(3)} kWh`
    );
  };

  sendMeasurement();

  simulator.intervalId = setInterval(sendMeasurement, INTERVAL_MS);
}

function stopDeviceSimulator(deviceId: number): void {
  const simulator = activeSimulators.get(deviceId);
  if (simulator?.intervalId) {
    clearInterval(simulator.intervalId);
    activeSimulators.delete(deviceId);
    console.log(`Stopped simulator for device ${deviceId}`);
  }
}

async function syncSimulators(channel: amqp.Channel): Promise<void> {
  const devices = await fetchDevices();
  const currentDeviceIds = new Set(devices.map((d) => d.id));
  const activeDeviceIds = new Set(activeSimulators.keys());

  for (const deviceId of activeDeviceIds) {
    if (!currentDeviceIds.has(deviceId)) {
      stopDeviceSimulator(deviceId);
    }
  }

  for (const device of devices) {
    if (!activeSimulators.has(device.id)) {
      const simulator = createDeviceSimulator(device);
      activeSimulators.set(device.id, simulator);
      startDeviceSimulator(simulator, channel);
      console.log(
        `Started simulator for device ${device.id}: ${device.name} (Max: ${device.maximumConsumption} kWh)`
      );
    }
  }
}

async function startSimulatorManager() {
  console.log("========================================");
  console.log("  Device Simulator Manager Starting");
  console.log("========================================");
  console.log(`Interval: ${INTERVAL_MS / 1000}s`);
  console.log(`RabbitMQ: ${RABBITMQ_URL}`);
  console.log(`Device Service: ${DEVICE_SERVICE_URL}`);
  console.log("========================================\n");

  try {
    console.log("Waiting for device service...");
    let devices: Device[] = [];
    let retries = 0;
    const maxRetries = 30;

    while (devices.length === 0 && retries < maxRetries) {
      devices = await fetchDevices();
      if (devices.length === 0) {
        retries++;
        console.log(
          `No devices found, retrying in 5s... (${retries}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    if (devices.length === 0) {
      console.log("No devices found after retries. Exiting.");
      process.exit(1);
    }

    console.log(`\nFound ${devices.length} device(s)`);

    console.log("\nConnecting to RabbitMQ...");
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log("Connected to RabbitMQ\n");

    console.log("Creating device simulators...\n");
    await syncSimulators(channel);

    console.log(`\nStarted ${activeSimulators.size} device simulator(s)\n`);
    console.log("Sending measurements...\n");

    setInterval(async () => {
      await syncSimulators(channel);
    }, 60000);

    const shutdown = async () => {
      console.log("\nShutting down simulators...");
      for (const deviceId of activeSimulators.keys()) {
        stopDeviceSimulator(deviceId);
      }
      await channel.close();
      await connection.close();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Failed to start simulator manager:", error);
    process.exit(1);
  }
}

startSimulatorManager();
