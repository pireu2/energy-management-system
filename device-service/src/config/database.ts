import { DataSource } from "typeorm";
import { Device } from "../models/Device";
import { MirroredUser } from "../models/MirroredUser";
import dotenv from "dotenv";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5433"),
  username: process.env.DB_USER || "energy_user",
  password: process.env.DB_PASSWORD || "energy_password",
  database: process.env.DB_NAME || "device_management",
  synchronize: process.env.NODE_ENV === "development",
  logging: process.env.NODE_ENV === "development",
  entities: [Device, MirroredUser],
  migrations: [],
  subscribers: [],
});
