import "reflect-metadata"; // Must be first import for TypeORM
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import initializeDatabase from "./config/init";
import userRoutes from "./routes/userRoutes";
import { connectRabbitMQ } from "./config/rabbitmq";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/users", userRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "User Service" });
});

const startServer = async () => {
  try {
    await initializeDatabase();
    await connectRabbitMQ();

    app.listen(PORT, () => {
      console.log(`User service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
