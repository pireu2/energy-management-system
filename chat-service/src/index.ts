import express, { Request, Response } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { findRuleMatch, getAllRules } from "./rules/chatRules";
import { getAIResponse, isAIEnabled } from "./services/aiService";
import { connectRabbitMQ, publishToQueue, QUEUES } from "./config/rabbitmq";
import { pool, testConnection, initializeDatabase } from "./config/database";

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "dG8ksW9pQ2vRxN4mF7jP1zL3bH6sA8cE5qY9wT0uI2rO4vX7nK3gD6fS1mP8hL5c";

interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
}

function authenticateToken(req: AuthRequest, res: Response, next: () => void) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      userId: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}

app.post(
  "/chat/session",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { targetAdminId, chatMode } = req.body;

      // Check for existing active session with the same parameters
      let existingSession = null;
      if (chatMode === "bot") {
        // Look for existing bot session for this user
        const result = await pool.query(
          `SELECT * FROM chat_sessions 
           WHERE user_id = $1 AND session_type = 'bot' AND status != 'closed'
           ORDER BY updated_at DESC LIMIT 1`,
          [user.userId]
        );
        if (result.rows.length > 0) {
          existingSession = result.rows[0];
        }
      } else if (chatMode === "admin" && targetAdminId) {
        // Look for existing admin session with this specific admin
        const result = await pool.query(
          `SELECT * FROM chat_sessions 
           WHERE user_id = $1 AND admin_id = $2 AND session_type = 'admin' AND status != 'closed'
           ORDER BY updated_at DESC LIMIT 1`,
          [user.userId, targetAdminId]
        );
        if (result.rows.length > 0) {
          existingSession = result.rows[0];
        }
      }

      // Return existing session if found
      if (existingSession) {
        return res.json({
          session: existingSession,
          isExisting: true,
        });
      }

      // Create new session
      const sessionResult = await pool.query(
        "INSERT INTO chat_sessions (user_id, user_email, status, admin_id, session_type) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [
          user.userId,
          user.email,
          chatMode === "admin" ? "waiting_admin" : "active",
          targetAdminId || null,
          chatMode || "bot",
        ]
      );

      res.json({
        session: sessionResult.rows[0],
        isExisting: false,
      });
    } catch (error) {
      console.error("Create session error:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  }
);

app.post(
  "/chat/session/:sessionId/message",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { message } = req.body;
      const user = req.user!;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: "Message is required" });
      }

      const session = await pool.query(
        "SELECT * FROM chat_sessions WHERE id = $1",
        [sessionId]
      );

      if (session.rows.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (user.role !== "admin" && session.rows[0].user_id !== user.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const sessionData = session.rows[0];

      await pool.query(
        "INSERT INTO chat_messages (session_id, user_id, sender_type, message) VALUES ($1, $2, $3, $4)",
        [sessionId, user.userId, "user", message]
      );

      if (
        sessionData.session_type === "admin" ||
        sessionData.status === "waiting_admin"
      ) {
        if (sessionData.admin_id) {
          await publishToQueue(QUEUES.NOTIFICATIONS, {
            type: "chat",
            userId: sessionData.admin_id,
            fromUserId: user.userId,
            fromUserEmail: user.email,
            message,
            toUser: sessionData.admin_id,
            data: {
              sessionId: parseInt(sessionId),
              type: "user_message",
              fromUserEmail: user.email,
            },
          });
        }

        await pool.query(
          "UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1",
          [sessionId]
        );

        return res.json({
          response: null,
          responseType: "admin_pending",
          timestamp: new Date().toISOString(),
        });
      }

      let responseText: string;
      let responseType: string;

      const ruleResponse = findRuleMatch(message);
      if (ruleResponse) {
        responseText = ruleResponse;
        responseType = "rule";
      } else if (isAIEnabled()) {
        responseText = await getAIResponse(message);
        responseType = "ai";
      } else {
        responseText =
          "I couldn't find a specific answer to your question. Would you like to speak with an admin? You can switch to admin mode using the toggle above.";
        responseType = "fallback";
      }

      const botMessageResult = await pool.query(
        "INSERT INTO chat_messages (session_id, user_id, sender_type, message, response_type) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [sessionId, user.userId, "bot", responseText, responseType]
      );

      await pool.query(
        "UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1",
        [sessionId]
      );

      // No need to send notification for bot responses - user gets response via HTTP

      res.json({
        response: botMessageResult.rows[0],
        responseType,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Chat message error:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  }
);

app.post(
  "/chat/session/:sessionId/switch-mode",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { mode, targetAdminId } = req.body;
      const user = req.user!;

      const session = await pool.query(
        "SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2",
        [sessionId, user.userId]
      );

      if (session.rows.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }

      await pool.query(
        "UPDATE chat_sessions SET session_type = $1, status = $2, admin_id = $3, updated_at = NOW() WHERE id = $4",
        [
          mode,
          mode === "admin" ? "waiting_admin" : "active",
          targetAdminId || null,
          sessionId,
        ]
      );

      if (mode === "admin" && targetAdminId) {
        await publishToQueue(QUEUES.NOTIFICATIONS, {
          type: "admin_request",
          userId: targetAdminId,
          fromUserId: user.userId,
          fromUserEmail: user.email,
          message: `User ${user.email} wants to chat with you`,
          toUser: targetAdminId,
          data: { sessionId },
        });
      }

      res.json({
        success: true,
        mode,
        status: mode === "admin" ? "waiting_admin" : "active",
      });
    } catch (error) {
      console.error("Switch mode error:", error);
      res.status(500).json({ error: "Failed to switch mode" });
    }
  }
);

app.post(
  "/chat/session/:sessionId/request-admin",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const user = req.user!;

      const session = await pool.query(
        "SELECT * FROM chat_sessions WHERE id = $1",
        [sessionId]
      );

      if (session.rows.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.rows[0].user_id !== user.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await pool.query(
        "UPDATE chat_sessions SET status = $1, updated_at = NOW() WHERE id = $2",
        ["waiting_admin", sessionId]
      );

      // Notify admins
      await publishToQueue(QUEUES.NOTIFICATIONS, {
        type: "admin_request",
        userId: user.userId,
        userEmail: user.email,
        message: `User ${user.email} is requesting admin assistance`,
        data: { sessionId },
      });

      res.json({
        success: true,
        status: "waiting_admin",
      });
    } catch (error) {
      console.error("Request admin error:", error);
      res.status(500).json({ error: "Failed to request admin" });
    }
  }
);

app.post(
  "/chat/message",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { message, sessionId } = req.body;
      const user = req.user!;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: "Message is required" });
      }

      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const sessionResult = await pool.query(
          "INSERT INTO chat_sessions (user_id, user_email) VALUES ($1, $2) RETURNING id",
          [user.userId, user.email]
        );
        currentSessionId = sessionResult.rows[0].id;
      }

      await pool.query(
        "INSERT INTO chat_messages (session_id, user_id, sender_type, message) VALUES ($1, $2, $3, $4)",
        [currentSessionId, user.userId, "user", message]
      );

      let response: string;
      let responseType: string;

      const ruleResponse = findRuleMatch(message);
      if (ruleResponse) {
        response = ruleResponse;
        responseType = "rule";
      } else if (isAIEnabled()) {
        response = await getAIResponse(message);
        responseType = "ai";
      } else {
        response =
          "Your message has been received. An administrator will respond shortly. For immediate assistance, please try asking about: devices, consumption, alerts, account, or support.";
        responseType = "fallback";
      }

      await pool.query(
        "INSERT INTO chat_messages (session_id, user_id, sender_type, message, response_type) VALUES ($1, $2, $3, $4, $5)",
        [currentSessionId, user.userId, "bot", response, responseType]
      );

      // No need to send notification - user gets response via HTTP

      res.json({
        sessionId: currentSessionId,
        response,
        responseType,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Chat message error:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  }
);

app.post(
  "/chat/admin/reply",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId, message } = req.body;
      const admin = req.user!;

      if (admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      if (!message || !sessionId) {
        return res
          .status(400)
          .json({ error: "Message and sessionId are required" });
      }

      const session = await pool.query(
        "SELECT * FROM chat_sessions WHERE id = $1",
        [sessionId]
      );

      if (session.rows.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }

      const targetUserId = session.rows[0].user_id;

      const adminMessageResult = await pool.query(
        "INSERT INTO chat_messages (session_id, user_id, sender_type, message, response_type) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [sessionId, admin.userId, "admin", message, "admin"]
      );

      await pool.query(
        "UPDATE chat_sessions SET status = $1, admin_id = $2, updated_at = NOW() WHERE id = $3",
        ["active", admin.userId, sessionId]
      );

      await publishToQueue(QUEUES.NOTIFICATIONS, {
        type: "admin_chat",
        userId: targetUserId,
        message,
        toUser: targetUserId,
        data: {
          sessionId,
          fromAdmin: true,
          adminId: admin.userId,
          adminEmail: admin.email,
        },
      });

      res.json({
        success: true,
        message: adminMessageResult.rows[0],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Admin reply error:", error);
      res.status(500).json({ error: "Failed to send reply" });
    }
  }
);

app.get(
  "/chat/admin/requests",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const admin = req.user!;

      if (admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const sessions = await pool.query(
        `SELECT cs.*, 
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = cs.id) as message_count,
          (SELECT message FROM chat_messages WHERE session_id = cs.id ORDER BY created_at DESC LIMIT 1) as last_message
         FROM chat_sessions cs
         WHERE (cs.admin_id = $1 OR (cs.status = 'waiting_admin' AND cs.admin_id IS NULL))
         AND cs.session_type = 'admin'
         ORDER BY cs.updated_at DESC`,
        [admin.userId]
      );

      res.json(sessions.rows);
    } catch (error) {
      console.error("Get admin requests error:", error);
      res.status(500).json({ error: "Failed to get requests" });
    }
  }
);

app.get(
  "/chat/sessions",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      let sessions;

      if (user.role === "admin") {
        sessions = await pool.query(
          "SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT 50"
        );
      } else {
        sessions = await pool.query(
          "SELECT * FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC",
          [user.userId]
        );
      }

      res.json(sessions.rows);
    } catch (error) {
      console.error("Get sessions error:", error);
      res.status(500).json({ error: "Failed to get sessions" });
    }
  }
);

app.get(
  "/chat/sessions/:sessionId/messages",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const user = req.user!;

      const session = await pool.query(
        "SELECT * FROM chat_sessions WHERE id = $1",
        [sessionId]
      );

      if (session.rows.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (user.role !== "admin" && session.rows[0].user_id !== user.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await pool.query(
        "SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC",
        [sessionId]
      );

      res.json(messages.rows);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  }
);

app.get("/chat/rules", (req: Request, res: Response) => {
  const rules = getAllRules();
  res.json({
    count: rules.length,
    rules: rules.map((r) => ({
      keywords: r.keywords,
      priority: r.priority,
    })),
  });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    service: "Chat Service",
    aiEnabled: isAIEnabled(),
  });
});

async function startServer() {
  try {
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error("Database connection failed");
    }

    await initializeDatabase();
    await connectRabbitMQ();

    const PORT = process.env.PORT || 3007;
    app.listen(PORT, () => {
      console.log(`Chat service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start chat service:", error);
    process.exit(1);
  }
}

startServer();
