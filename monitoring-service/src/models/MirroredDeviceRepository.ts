import { pool } from "../config/database";
import { MirroredDevice } from "./MirroredDevice";

export class MirroredDeviceRepository {
  async findById(id: number): Promise<MirroredDevice | null> {
    const result = await pool.query(
      "SELECT * FROM mirrored_devices WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(): Promise<MirroredDevice[]> {
    const result = await pool.query(
      "SELECT * FROM mirrored_devices ORDER BY id"
    );
    return result.rows;
  }

  async create(device: {
    id: number;
    name: string;
    maximum_consumption: number;
    assigned_user_id?: number;
  }): Promise<MirroredDevice> {
    const result = await pool.query(
      `INSERT INTO mirrored_devices (id, name, maximum_consumption, assigned_user_id) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (id) DO UPDATE SET 
         name = $2, 
         maximum_consumption = $3, 
         assigned_user_id = $4
       RETURNING *`,
      [
        device.id,
        device.name,
        device.maximum_consumption,
        device.assigned_user_id || null,
      ]
    );
    return result.rows[0];
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query(
      "DELETE FROM mirrored_devices WHERE id = $1",
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
