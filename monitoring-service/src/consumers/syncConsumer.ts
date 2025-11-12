import { Channel } from "amqplib";
import { QUEUES } from "../config/rabbitmq";
import { MirroredUserRepository } from "../models/MirroredUserRepository";
import { MirroredDeviceRepository } from "../models/MirroredDeviceRepository";

const userRepository = new MirroredUserRepository();
const deviceRepository = new MirroredDeviceRepository();

interface SyncMessage {
  type:
    | "user_created"
    | "user_updated"
    | "user_deleted"
    | "device_created"
    | "device_updated"
    | "device_deleted";
  data: any;
}

export async function startSyncConsumer(channel: Channel) {
  console.log("Starting synchronization consumer...");

  await channel.prefetch(1);

  channel.consume(
    QUEUES.SYNC,
    async (msg) => {
      if (!msg) return;

      try {
        const syncMsg: SyncMessage = JSON.parse(msg.content.toString());
        console.log(`Received sync message:`, syncMsg);

        switch (syncMsg.type) {
          case "user_created":
          case "user_updated":
            await handleUserSync(syncMsg.data);
            break;

          case "user_deleted":
            await handleUserDelete(syncMsg.data.id);
            break;

          case "device_created":
          case "device_updated":
            await handleDeviceSync(syncMsg.data);
            break;

          case "device_deleted":
            await handleDeviceDelete(syncMsg.data.id);
            break;

          default:
            console.warn(`Unknown sync type: ${syncMsg.type}`);
        }

        channel.ack(msg);
      } catch (error) {
        console.error("Error processing sync message:", error);
        channel.nack(msg, false, true);
      }
    },
    { noAck: false }
  );

  console.log("✓ Synchronization consumer started");
}

async function handleUserSync(userData: any) {
  try {
    if (!userData.id || !userData.email) {
      console.error("Invalid user data:", userData);
      return;
    }

    await userRepository.create({
      id: userData.id,
      email: userData.email,
    });

    console.log(`Synced user: ${userData.id}`);
  } catch (error) {
    console.error("Error syncing user:", error);
    throw error;
  }
}

async function handleUserDelete(userId: number) {
  try {
    await userRepository.delete(userId);
    console.log(`Deleted user: ${userId}`);
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

async function handleDeviceSync(deviceData: any) {
  try {
    if (!deviceData.id || !deviceData.name || !deviceData.maximumConsumption) {
      console.error("Invalid device data:", deviceData);
      return;
    }

    await deviceRepository.create({
      id: deviceData.id,
      name: deviceData.name,
      maximum_consumption: deviceData.maximumConsumption,
      assigned_user_id: deviceData.assignedUserId,
    });

    console.log(`Synced device: ${deviceData.id}`);
  } catch (error) {
    console.error("Error syncing device:", error);
    throw error;
  }
}

async function handleDeviceDelete(deviceId: number) {
  try {
    await deviceRepository.delete(deviceId);
    console.log(`Deleted device: ${deviceId}`);
  } catch (error) {
    console.error("Error deleting device:", error);
    throw error;
  }
}
