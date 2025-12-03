import { Channel } from "amqplib";
import { QUEUES, publishNotification, getDeviceId } from "../config/rabbitmq";
import { MeasurementRepository } from "../models/MeasurementRepository";
import { MirroredDeviceRepository } from "../models/MirroredDeviceRepository";

const measurementRepository = new MeasurementRepository();
const deviceRepository = new MirroredDeviceRepository();

const notifiedDevices = new Map<string, boolean>();

// Track which device consumers are already running
const activeDeviceConsumers = new Set<number>();

interface DeviceDataMessage {
  timestamp: string;
  device_id: number;
  measurement_value: number;
}

function getNotificationKey(deviceId: number, hourStart: Date): string {
  return `${deviceId}-${hourStart.toISOString()}`;
}

async function processDeviceMessage(
  channel: Channel,
  data: DeviceDataMessage
): Promise<void> {
  const device = await deviceRepository.findById(data.device_id);
  if (!device) {
    console.warn(`Device ${data.device_id} not found in mirrored_devices`);
    return;
  }

  const timestamp = new Date(data.timestamp);
  await measurementRepository.createMeasurement({
    device_id: data.device_id,
    timestamp,
    measurement_value: data.measurement_value,
  });

  const hourStart = new Date(timestamp);
  hourStart.setMinutes(0, 0, 0);

  const hourEnd = new Date(hourStart);
  hourEnd.setHours(hourEnd.getHours() + 1);

  const intervalHours = 10 / 3600;
  const energyConsumption = data.measurement_value * intervalHours;

  await measurementRepository.upsertHourlyConsumption({
    device_id: data.device_id,
    hour_start: hourStart,
    hour_end: hourEnd,
    total_consumption: energyConsumption,
    measurement_count: 1,
  });

  const hourlyTotal = await measurementRepository.getHourlyConsumption(
    data.device_id,
    hourStart
  );

  // Parse values as numbers (PostgreSQL returns numeric as string)
  const totalConsumption = hourlyTotal
    ? parseFloat(String(hourlyTotal.total_consumption))
    : 0;
  const maxConsumption = device.maximum_consumption
    ? parseFloat(String(device.maximum_consumption))
    : 0;

  console.log(
    `Device ${data.device_id}: hourly=${totalConsumption.toFixed(
      4
    )} kWh, max=${maxConsumption} kWh`
  );

  // Check if hourly consumption exceeds device maximum
  if (hourlyTotal && maxConsumption > 0 && totalConsumption > maxConsumption) {
    const notificationKey = getNotificationKey(data.device_id, hourStart);

    // Only send notification once per device per hour
    if (!notifiedDevices.has(notificationKey)) {
      notifiedDevices.set(notificationKey, true);

      console.log(
        `OVERCONSUMPTION ALERT for device ${
          data.device_id
        }: ${totalConsumption.toFixed(4)} > ${maxConsumption}`
      );

      await publishNotification({
        type: "overconsumption",
        userId: device.assigned_user_id || 0,
        deviceId: data.device_id,
        message: `Device "${device.name}" has exceeded its maximum hourly consumption limit of ${maxConsumption} kWh`,
        data: {
          deviceName: device.name,
          currentConsumption: totalConsumption.toFixed(2),
          maxAllowed: maxConsumption,
          hourStart: hourStart.toISOString(),
        },
      });

      // Clean up old notification keys (keep only last 24 hours)
      const now = new Date();
      for (const [key] of notifiedDevices) {
        const keyHour = new Date(key.split("-").slice(1).join("-"));
        if (now.getTime() - keyHour.getTime() > 24 * 60 * 60 * 1000) {
          notifiedDevices.delete(key);
        }
      }
    }
  }
}

async function startConsumerForDevice(
  channel: Channel,
  deviceId: number
): Promise<void> {
  if (activeDeviceConsumers.has(deviceId)) {
    return; // Already consuming from this device's queue
  }

  const queueName = `ingest_queue_${deviceId}`;

  try {
    await channel.assertQueue(queueName, { durable: true });

    channel.consume(
      queueName,
      async (msg) => {
        if (!msg) return;

        try {
          const data: DeviceDataMessage = JSON.parse(msg.content.toString());

          if (
            !data.device_id ||
            !data.timestamp ||
            data.measurement_value === undefined
          ) {
            console.error("Invalid message format:", data);
            channel.nack(msg, false, false);
            return;
          }

          await processDeviceMessage(channel, data);
          channel.ack(msg);
        } catch (error) {
          console.error(
            `Error processing message for device ${deviceId}:`,
            error
          );
          channel.nack(msg, false, true);
        }
      },
      { noAck: false }
    );

    activeDeviceConsumers.add(deviceId);
    console.log(
      `Started consumer for device ${deviceId} on queue: ${queueName}`
    );
  } catch (error) {
    console.error(`Failed to start consumer for device ${deviceId}:`, error);
  }
}

export async function startMultiDeviceConsumers(
  channel: Channel,
  deviceIds: number[]
): Promise<void> {
  await channel.prefetch(1);

  for (const deviceId of deviceIds) {
    await startConsumerForDevice(channel, deviceId);
  }

  console.log(`Active consumers: ${activeDeviceConsumers.size} devices`);
}

export async function startDeviceDataConsumer(channel: Channel) {
  await channel.prefetch(1);

  const deviceId = getDeviceId();
  const queueToConsume = deviceId > 0 ? QUEUES.INGEST : QUEUES.DEVICE_DATA;

  console.log(
    `Monitoring service for device ${
      deviceId > 0 ? deviceId : "ALL"
    } consuming from: ${queueToConsume}`
  );

  channel.consume(
    queueToConsume,
    async (msg) => {
      if (!msg) return;

      try {
        const data: DeviceDataMessage = JSON.parse(msg.content.toString());

        if (
          !data.device_id ||
          !data.timestamp ||
          data.measurement_value === undefined
        ) {
          console.error("Invalid message format:", data);
          channel.nack(msg, false, false);
          return;
        }

        await processDeviceMessage(channel, data);
        channel.ack(msg);
      } catch (error) {
        console.error("Error processing device data:", error);
        channel.nack(msg, false, true);
      }
    },
    { noAck: false }
  );
}
