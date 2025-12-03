import amqp, { Channel, Connection } from "amqplib";

export const QUEUES = {
  DEVICE_DATA: "device_data_queue",
  INGEST_PREFIX: "ingest_queue_",
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

    await channel.assertQueue(QUEUES.DEVICE_DATA, { durable: true });

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

export async function assertIngestQueue(replicaId: number): Promise<void> {
  const ch = await connectRabbitMQ();
  const queueName = `${QUEUES.INGEST_PREFIX}${replicaId}`;
  await ch.assertQueue(queueName, { durable: true });
}

export async function publishToIngestQueue(
  replicaId: number,
  message: any
): Promise<boolean> {
  try {
    const ch = await connectRabbitMQ();
    const queueName = `${QUEUES.INGEST_PREFIX}${replicaId}`;
    const content = Buffer.from(JSON.stringify(message));
    return ch.sendToQueue(queueName, content, { persistent: true });
  } catch (error) {
    console.error(`Failed to publish to ingest queue ${replicaId}:`, error);
    return false;
  }
}
