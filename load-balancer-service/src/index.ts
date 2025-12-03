import express, { Request, Response } from "express";
import cors from "cors";
import {
  connectRabbitMQ,
  QUEUES,
  assertIngestQueue,
  publishToIngestQueue,
} from "./config/rabbitmq";
import { LoadBalancer } from "./strategies/loadBalancer";

const app = express();
app.use(cors());
app.use(express.json());

const REPLICA_COUNT = parseInt(process.env.REPLICA_COUNT || "3");
const STRATEGY = (process.env.LB_STRATEGY || "round-robin") as
  | "round-robin"
  | "least-loaded"
  | "consistent-hash";

const loadBalancer = new LoadBalancer(REPLICA_COUNT, STRATEGY);

interface DeviceDataMessage {
  timestamp: string;
  device_id: number;
  measurement_value: number;
}

async function initializeIngestQueues(): Promise<void> {
  for (let i = 1; i <= REPLICA_COUNT; i++) {
    await assertIngestQueue(i);
  }
}

async function startConsumer(): Promise<void> {
  const channel = await connectRabbitMQ();
  await channel.prefetch(10);

  channel.consume(
    QUEUES.DEVICE_DATA,
    async (msg) => {
      if (!msg) return;

      try {
        const data: DeviceDataMessage = JSON.parse(msg.content.toString());

        const replicaId = loadBalancer.selectReplica(data.device_id);

        const success = await publishToIngestQueue(replicaId, data);

        if (success) {
          loadBalancer.recordMessage(replicaId);
          channel.ack(msg);
        } else {
          channel.nack(msg, false, true);
        }
      } catch (error) {
        console.error("Error processing device data:", error);
        channel.nack(msg, false, true);
      }
    },
    { noAck: false }
  );
}

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    service: "Load Balancer Service",
    replicaCount: REPLICA_COUNT,
    strategy: STRATEGY,
  });
});

app.get("/stats", (req: Request, res: Response) => {
  const stats = loadBalancer.getStats();
  res.json(stats);
});

app.post("/stats/reset", (req: Request, res: Response) => {
  loadBalancer.resetStats();
  res.json({ success: true, message: "Stats reset" });
});

app.post("/replica/:id/health", (req: Request, res: Response) => {
  const replicaId = parseInt(req.params.id);
  const { isHealthy } = req.body;

  if (replicaId < 1 || replicaId > REPLICA_COUNT) {
    return res.status(400).json({ error: "Invalid replica ID" });
  }

  loadBalancer.setReplicaHealth(replicaId, isHealthy);
  res.json({ success: true, replicaId, isHealthy });
});

async function startServer() {
  try {
    await connectRabbitMQ();
    await initializeIngestQueues();
    await startConsumer();

    const PORT = process.env.PORT || 3008;
    app.listen(PORT, () => {
      console.log(`Load Balancer service running on port ${PORT}`);
      console.log(`Strategy: ${STRATEGY}, Replicas: ${REPLICA_COUNT}`);
    });
  } catch (error) {
    console.error("Failed to start load balancer service:", error);
    process.exit(1);
  }
}

startServer();
