import { Channel } from "amqplib";
import { QUEUES } from "../config/rabbitmq";
import { MeasurementRepository } from "../models/MeasurementRepository";
import { MirroredDeviceRepository } from "../models/MirroredDeviceRepository";

const measurementRepository = new MeasurementRepository();
const deviceRepository = new MirroredDeviceRepository();

interface DeviceDataMessage {
  timestamp: string;
  device_id: number;
  measurement_value: number;
}

export async function startDeviceDataConsumer(channel: Channel) {
  await channel.prefetch(1);

  channel.consume(
    QUEUES.DEVICE_DATA,
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

        const device = await deviceRepository.findById(data.device_id);
        if (!device) {
          console.warn(
            `Device ${data.device_id} not found in mirrored_devices`
          );
          channel.nack(msg, false, false);
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

        channel.ack(msg);
      } catch (error) {
        console.error("Error processing device data:", error);
        channel.nack(msg, false, true);
      }
    },
    { noAck: false }
  );
}
