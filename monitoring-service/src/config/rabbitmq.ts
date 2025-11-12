import amqp from "amqplib";

export const QUEUES = {
  DEVICE_DATA: "device_data_queue",
  SYNC: "sync_queue",
};

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://energy_user:energy_password@localhost:5672";

let connection: amqp.Connection | null = null;
let channel: amqp.Channel | null = null;

export async function connectRabbitMQ(): Promise<amqp.Channel> {
  try {
    if (channel) {
      return channel;
    }

    console.log("Connecting to RabbitMQ...");
    connection = (await amqp.connect(RABBITMQ_URL)) as any;
    channel = await (connection as any).createChannel();

    if (!channel) {
      throw new Error("Failed to create channel");
    }

    await channel.assertQueue(QUEUES.DEVICE_DATA, { durable: true });
    await channel.assertQueue(QUEUES.SYNC, { durable: true });

    console.log("✓ RabbitMQ connected successfully");

    (connection as any).on("error", (err: Error) => {
      console.error("RabbitMQ connection error:", err);
      channel = null;
      connection = null;
    });

    (connection as any).on("close", () => {
      console.log("RabbitMQ connection closed");
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

export async function closeRabbitMQ() {
  try {
    if (channel) await channel.close();
    if (connection) await (connection as any).close();
    console.log("RabbitMQ connection closed");
  } catch (error) {
    console.error("Error closing RabbitMQ connection:", error);
  }
}
