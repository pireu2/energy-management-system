import * as amqp from "amqplib";

const RABBITMQ_URL = "amqp://energy_user:energy_password@localhost:5672";
const DEVICE_SERVICE_URL = "http://localhost:3003/devices";
const INTERVAL_MS = 10000;
const QUEUE_NAME = "device_data_queue";

interface Device {
  id: number;
  name: string;
  maximumConsumption: number;
}

interface DeviceConfig {
  baseLoad: number;
  maxVariation: number;
}

const deviceConfigs = new Map<number, DeviceConfig>();

interface TimePattern {
  hour: number;
  multiplier: number;
}

const TIME_PATTERNS: TimePattern[] = [
  { hour: 0, multiplier: 0.5 }, // Night - very low
  { hour: 1, multiplier: 0.4 },
  { hour: 2, multiplier: 0.4 },
  { hour: 3, multiplier: 0.4 },
  { hour: 4, multiplier: 0.4 },
  { hour: 5, multiplier: 0.5 },
  { hour: 6, multiplier: 0.8 }, // Morning - rising
  { hour: 7, multiplier: 1.2 },
  { hour: 8, multiplier: 1.3 },
  { hour: 9, multiplier: 1.1 },
  { hour: 10, multiplier: 1.0 }, // Day - moderate
  { hour: 11, multiplier: 1.1 },
  { hour: 12, multiplier: 1.3 }, // Lunch
  { hour: 13, multiplier: 1.2 },
  { hour: 14, multiplier: 1.0 },
  { hour: 15, multiplier: 1.0 },
  { hour: 16, multiplier: 1.1 },
  { hour: 17, multiplier: 1.3 }, // Evening - high
  { hour: 18, multiplier: 1.5 },
  { hour: 19, multiplier: 1.6 }, // Peak evening
  { hour: 20, multiplier: 1.5 },
  { hour: 21, multiplier: 1.3 },
  { hour: 22, multiplier: 1.0 }, // Night - decreasing
  { hour: 23, multiplier: 0.7 },
];

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

function getDeviceConfig(device: Device): DeviceConfig {
  if (!deviceConfigs.has(device.id)) {
    // Calculate base load and variation based on max consumption
    // Assume average consumption is 40-60% of max
    const avgConsumptionRatio = 0.4 + Math.random() * 0.2;
    const baseLoad = device.maximumConsumption * avgConsumptionRatio;
    const maxVariation = baseLoad * 0.3; // ±30% variation

    deviceConfigs.set(device.id, { baseLoad, maxVariation });
  }
  return deviceConfigs.get(device.id)!;
}

function getTimeMultiplier(hour: number): number {
  const pattern = TIME_PATTERNS.find((p) => p.hour === hour);
  return pattern ? pattern.multiplier : 1.0;
}

function generateMeasurement(device: Device): number {
  const now = new Date();
  const hour = now.getHours();
  const config = getDeviceConfig(device);

  const timeMultiplier = getTimeMultiplier(hour);

  const randomVariation = (Math.random() - 0.5) * 2 * config.maxVariation;

  const measurement = config.baseLoad * timeMultiplier + randomVariation;

  return Math.max(
    0,
    Math.min(device.maximumConsumption, Number(measurement.toFixed(3)))
  );
}

async function sendMeasurement(
  channel: amqp.Channel,
  device: Device
): Promise<void> {
  const timestamp = new Date().toISOString();
  const measurementValue = generateMeasurement(device);

  const message = {
    timestamp,
    device_id: device.id,
    measurement_value: measurementValue,
  };

  const content = Buffer.from(JSON.stringify(message));
  channel.sendToQueue(QUEUE_NAME, content, { persistent: true });

  console.log(
    `[${timestamp}] Device ${device.id} (${device.name}): ${measurementValue} kWh`
  );
}

async function startSimulator() {
  try {
    console.log("========================================");
    console.log("  Multi-Device Simulator Starting");
    console.log("========================================");
    console.log(`Interval: ${INTERVAL_MS / 1000}s`);
    console.log(`RabbitMQ: ${RABBITMQ_URL}`);
    console.log(`Device Service: ${DEVICE_SERVICE_URL}`);
    console.log("========================================\n");

    console.log("Fetching devices from device service...");
    let devices = await fetchDevices();

    if (devices.length === 0) {
      console.log(
        "No devices found. Will retry fetching devices periodically."
      );
    } else {
      console.log(`✓ Found ${devices.length} device(s):`);
      devices.forEach((d) => {
        console.log(
          `  - Device ${d.id}: ${d.name} (Max: ${d.maximumConsumption} kWh)`
        );
      });
    }

    console.log("\nConnecting to RabbitMQ...");
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log("✓ Connected to RabbitMQ\n");
    console.log("Starting to send measurements...\n");

    setInterval(async () => {
      const newDevices = await fetchDevices();
      if (newDevices.length > 0) {
        devices = newDevices;
      }
    }, 60000);

    const sendForAllDevices = async () => {
      if (devices.length === 0) {
        console.log("No devices available, skipping...");
        return;
      }

      for (const device of devices) {
        try {
          await sendMeasurement(channel, device);
        } catch (error) {
          console.error(
            `Error sending measurement for device ${device.id}:`,
            error
          );
        }
      }
    };

    await sendForAllDevices();

    setInterval(sendForAllDevices, INTERVAL_MS);

    process.on("SIGTERM", async () => {
      console.log("\nSIGTERM signal received: closing connections");
      await channel.close();
      await connection.close();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      console.log("\nSIGINT signal received: closing connections");
      await channel.close();
      await connection.close();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start simulator:", error);
    process.exit(1);
  }
}

startSimulator();
