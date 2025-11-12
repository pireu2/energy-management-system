import amqp from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://energy_user:energy_password@localhost:5672";
const SYNC_EXCHANGE = "sync_exchange";
const DEVICE_SERVICE_QUEUE = "sync_queue_device_service";

let connection: amqp.Connection | null = null;
let channel: amqp.Channel | null = null;

export async function connectRabbitMQ(): Promise<amqp.Channel> {
  try {
    if (channel && connection) {
      try {
        await channel.checkQueue(DEVICE_SERVICE_QUEUE);
        return channel;
      } catch (e) {
        channel = null;
        connection = null;
      }
    }

    connection = (await amqp.connect(RABBITMQ_URL)) as any;
    channel = await (connection as any).createChannel();

    if (!channel) {
      throw new Error("Failed to create channel");
    }

    await channel.assertExchange(SYNC_EXCHANGE, "fanout", { durable: true });
    await channel.assertQueue(DEVICE_SERVICE_QUEUE, { durable: true });
    await channel.bindQueue(DEVICE_SERVICE_QUEUE, SYNC_EXCHANGE, "");

    (connection as any).on("error", (err: Error) => {
      console.error("RabbitMQ connection error:", err);
      channel = null;
      connection = null;
    });

    (connection as any).on("close", () => {
      channel = null;
      connection = null;
    });

    return channel;
  } catch (error) {
    console.error("Failed to connect to RabbitMQ:", error);
    channel = null;
    connection = null;
    throw error;
  }
}

export async function publishSyncEvent(
  type: string,
  data: any
): Promise<boolean> {
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ch = await connectRabbitMQ();
      const message = { type, data };
      const content = Buffer.from(JSON.stringify(message));

      ch.publish(SYNC_EXCHANGE, "", content, { persistent: true });
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    } catch (error) {
      lastError = error;
      channel = null;
      connection = null;
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }

  console.error(`Failed to publish sync event ${type}:`, lastError);
  return false;
}

export async function consumeSyncEvents(
  onMessage: (type: string, data: any) => Promise<void>
) {
  try {
    const ch = await connectRabbitMQ();
    await ch.prefetch(1);

    ch.consume(
      DEVICE_SERVICE_QUEUE,
      async (msg) => {
        if (!msg) return;

        try {
          const syncMsg = JSON.parse(msg.content.toString());
          await onMessage(syncMsg.type, syncMsg.data);
          ch.ack(msg);
        } catch (error) {
          console.error("Error processing sync message:", error);
          ch.nack(msg, false, true);
        }
      },
      { noAck: false }
    );
  } catch (error) {
    console.error("Failed to start sync consumer:", error);
  }
}

export async function closeRabbitMQ() {
  try {
    if (channel) await channel.close();
    if (connection) await (connection as any).close();
  } catch (error) {
    console.error("Error closing RabbitMQ connection:", error);
  }
}
