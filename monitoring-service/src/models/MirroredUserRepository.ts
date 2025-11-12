import { pool } from "../config/database";
import { MirroredUser } from "./MirroredUser";

export class MirroredUserRepository {
  async findById(id: number): Promise<MirroredUser | null> {
    const result = await pool.query(
      "SELECT * FROM mirrored_users WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(): Promise<MirroredUser[]> {
    const result = await pool.query("SELECT * FROM mirrored_users ORDER BY id");
    return result.rows;
  }

  async create(user: { id: number; email: string }): Promise<MirroredUser> {
    const result = await pool.query(
      `INSERT INTO mirrored_users (id, email) 
       VALUES ($1, $2) 
       ON CONFLICT (id) DO UPDATE SET email = $2
       RETURNING *`,
      [user.id, user.email]
    );
    return result.rows[0];
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query(
      "DELETE FROM mirrored_users WHERE id = $1",
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
