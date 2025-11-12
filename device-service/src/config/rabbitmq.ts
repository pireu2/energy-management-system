import amqp from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://energy_user:energy_password@localhost:5672";
const SYNC_QUEUE = "sync_queue";

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

    await channel.assertQueue(SYNC_QUEUE, { durable: true });

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

export async function publishSyncEvent(
  type: string,
  data: any
): Promise<boolean> {
  try {
    const ch = await connectRabbitMQ();
    const message = { type, data };
    const content = Buffer.from(JSON.stringify(message));
    return ch.sendToQueue(SYNC_QUEUE, content, { persistent: true });
  } catch (error) {
    console.error(`Failed to publish sync event:`, error);
    return false;
  }
}

export async function consumeSyncEvents(
  onMessage: (type: string, data: any) => Promise<void>
) {
  try {
    const ch = await connectRabbitMQ();

    await ch.prefetch(1);

    ch.consume(
      SYNC_QUEUE,
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

    console.log("✓ Sync consumer started");
  } catch (error) {
    console.error("Failed to start sync consumer:", error);
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
