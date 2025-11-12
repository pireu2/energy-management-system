import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5437"),
  database: process.env.DB_NAME || "monitoring_db",
  user: process.env.DB_USER || "energy_user",
  password: process.env.DB_PASSWORD || "energy_password",
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log("✓ Database connected successfully");
    client.release();
    return true;
  } catch (error) {
    console.error("✗ Database connection failed:", error);
    return false;
  }
}
