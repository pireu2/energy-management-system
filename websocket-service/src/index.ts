import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { connectRabbitMQ, QUEUES } from "./config/rabbitmq";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "dG8ksW9pQ2vRxN4mF7jP1zL3bH6sA8cE5qY9wT0uI2rO4vX7nK3gD6fS1mP8hL5c";

interface AuthenticatedSocket extends WebSocket {
  userId?: number;
  userEmail?: string;
  userRole?: string;
  isAlive?: boolean;
}

interface NotificationMessage {
  type: "overconsumption" | "chat" | "system";
  userId?: number;
  deviceId?: number;
  message: string;
  data?: any;
  timestamp: string;
}

const clients = new Map<number, Set<AuthenticatedSocket>>();
const adminClients = new Set<AuthenticatedSocket>();

function authenticateToken(
  token: string
): { userId: number; email: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

wss.on("connection", (ws: AuthenticatedSocket, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");

  if (!token) {
    ws.close(4001, "Authentication required");
    return;
  }

  const user = authenticateToken(token);
  if (!user) {
    ws.close(4002, "Invalid token");
    return;
  }

  ws.userId = user.userId;
  ws.userEmail = user.email;
  ws.userRole = user.role;
  ws.isAlive = true;

  if (!clients.has(user.userId)) {
    clients.set(user.userId, new Set());
  }
  clients.get(user.userId)!.add(ws);

  if (user.role === "admin") {
    adminClients.add(ws);
  }

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleClientMessage(ws, message);
    } catch (error) {
      console.error("Invalid message format:", error);
    }
  });

  ws.on("close", () => {
    if (ws.userId) {
      const userSockets = clients.get(ws.userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          clients.delete(ws.userId);
        }
      }
    }
    adminClients.delete(ws);
  });

  ws.send(
    JSON.stringify({
      type: "connected",
      message: "WebSocket connection established",
      userId: user.userId,
      timestamp: new Date().toISOString(),
    })
  );
});

function handleClientMessage(ws: AuthenticatedSocket, message: any) {
  if (message.type === "chat") {
    broadcastToAdmins({
      type: "chat",
      userId: ws.userId,
      userEmail: ws.userEmail,
      message: message.content,
      timestamp: new Date().toISOString(),
    });
  }
}

function sendToUser(userId: number, message: NotificationMessage) {
  const userSockets = clients.get(userId);
  if (userSockets) {
    const messageStr = JSON.stringify(message);
    userSockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(messageStr);
      }
    });
  }
}

function broadcastToAdmins(message: any) {
  const messageStr = JSON.stringify(message);
  adminClients.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(messageStr);
    }
  });
}

function broadcastToAll(message: NotificationMessage) {
  const messageStr = JSON.stringify(message);
  clients.forEach((sockets) => {
    sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(messageStr);
      }
    });
  });
}

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const socket = ws as AuthenticatedSocket;
    if (socket.isAlive === false) {
      return socket.terminate();
    }
    socket.isAlive = false;
    socket.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});

app.post("/notify/overconsumption", (req, res) => {
  const { userId, deviceId, deviceName, currentValue, maxValue } = req.body;

  const notification: NotificationMessage = {
    type: "overconsumption",
    userId,
    deviceId,
    message: `Alert: Device "${deviceName}" exceeded maximum consumption! Current: ${currentValue.toFixed(
      2
    )} kW, Max: ${maxValue} kW`,
    data: { deviceId, deviceName, currentValue, maxValue },
    timestamp: new Date().toISOString(),
  };

  sendToUser(userId, notification);
  broadcastToAdmins(notification);

  res.json({ success: true, message: "Notification sent" });
});

app.post("/notify/chat", (req, res) => {
  const { userId, message, fromAdmin, adminId } = req.body;

  const chatMessage: NotificationMessage = {
    type: "chat",
    userId,
    message,
    data: { fromAdmin, adminId },
    timestamp: new Date().toISOString(),
  };

  if (fromAdmin) {
    sendToUser(userId, chatMessage);
  } else {
    broadcastToAdmins(chatMessage);
  }

  res.json({ success: true, message: "Chat message sent" });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "WebSocket Service",
    connections: wss.clients.size,
  });
});

app.get("/stats", (req, res) => {
  res.json({
    totalConnections: wss.clients.size,
    uniqueUsers: clients.size,
    adminConnections: adminClients.size,
  });
});

async function startServer() {
  try {
    const channel = await connectRabbitMQ();

    channel.consume(QUEUES.NOTIFICATIONS, (msg) => {
      if (!msg) return;

      try {
        const notification = JSON.parse(msg.content.toString());

        if (notification.type === "overconsumption") {
          const message: NotificationMessage = {
            type: "overconsumption",
            userId: notification.userId,
            deviceId: notification.deviceId,
            message: notification.message,
            data: notification.data,
            timestamp: new Date().toISOString(),
          };

          if (notification.userId) {
            sendToUser(notification.userId, message);
          }
          broadcastToAdmins(message);
        } else if (notification.type === "chat") {
          const chatMessage: NotificationMessage = {
            type: "chat",
            userId: notification.userId,
            message: notification.message,
            data: notification.data,
            timestamp: new Date().toISOString(),
          };

          if (notification.toUser) {
            sendToUser(notification.toUser, chatMessage);
          } else {
            broadcastToAdmins(chatMessage);
          }
        } else if (notification.type === "admin_chat") {
          // Admin response to user
          const adminChatMessage: NotificationMessage = {
            type: "chat",
            userId: notification.userId,
            message: notification.message,
            data: {
              ...notification.data,
              type: "admin_chat",
            },
            timestamp: new Date().toISOString(),
          };
          if (notification.toUser) {
            sendToUser(notification.toUser, adminChatMessage);
          }
        } else if (notification.type === "admin_request") {
          // User requesting to chat with admin
          const adminRequestMessage: NotificationMessage = {
            type: "chat",
            userId: notification.fromUserId,
            message: notification.message,
            data: {
              ...notification.data,
              type: "admin_request",
              fromUserEmail: notification.fromUserEmail,
            },
            timestamp: new Date().toISOString(),
          };
          // Send to specific admin if targeted
          if (notification.toUser) {
            sendToUser(notification.toUser, adminRequestMessage);
          } else {
            broadcastToAdmins(adminRequestMessage);
          }
        }

        channel.ack(msg);
      } catch (error) {
        console.error("Error processing notification:", error);
        channel.nack(msg, false, false);
      }
    });

    const PORT = process.env.PORT || 3006;
    server.listen(PORT, () => {
      console.log(`WebSocket service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start WebSocket service:", error);
    process.exit(1);
  }
}

export { sendToUser, broadcastToAdmins, broadcastToAll };

startServer();
