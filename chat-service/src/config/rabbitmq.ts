import amqp, { Channel, Connection } from "amqplib";

export const QUEUES = {
  NOTIFICATIONS: "notifications_queue",
  CHAT: "chat_queue",
};

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://energy_user:energy_password@localhost:5672";

let connection: Connection | null = null;
let channel: Channel | null = null;

export async function connectRabbitMQ(): Promise<Channel> {
  try {
    if (channel) {
      return channel;
    }

    const conn = await amqp.connect(RABBITMQ_URL);
    connection = conn as unknown as Connection;
    channel = await conn.createChannel();

    await channel.assertQueue(QUEUES.NOTIFICATIONS, { durable: true });
    await channel.assertQueue(QUEUES.CHAT, { durable: true });

    conn.on("error", (err: Error) => {
      console.error("RabbitMQ connection error:", err);
      channel = null;
      connection = null;
    });

    conn.on("close", () => {
      channel = null;
      connection = null;
    });

    return channel;
  } catch (error) {
    console.error("Failed to connect to RabbitMQ:", error);
    throw error;
  }
}

export async function publishToQueue(
  queue: string,
  message: any
): Promise<boolean> {
  try {
    const ch = await connectRabbitMQ();
    const content = Buffer.from(JSON.stringify(message));
    return ch.sendToQueue(queue, content, { persistent: true });
  } catch (error) {
    console.error(`Failed to publish to queue ${queue}:`, error);
    return false;
  }
}
