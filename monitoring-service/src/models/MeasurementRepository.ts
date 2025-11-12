import { pool } from "../config/database";
import { DeviceMeasurement, HourlyEnergyConsumption } from "./Measurement";

export class MeasurementRepository {
  async createMeasurement(measurement: {
    device_id: number;
    timestamp: Date;
    measurement_value: number;
  }): Promise<DeviceMeasurement> {
    const result = await pool.query(
      `INSERT INTO device_measurements (device_id, timestamp, measurement_value) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (device_id, timestamp) DO UPDATE 
       SET measurement_value = $3
       RETURNING *`,
      [
        measurement.device_id,
        measurement.timestamp,
        measurement.measurement_value,
      ]
    );
    return result.rows[0];
  }

  async getHourlyConsumption(
    deviceId: number,
    hourStart: Date
  ): Promise<HourlyEnergyConsumption | null> {
    const result = await pool.query(
      `SELECT * FROM hourly_energy_consumption 
       WHERE device_id = $1 AND hour_start = $2`,
      [deviceId, hourStart]
    );
    return result.rows[0] || null;
  }

  async upsertHourlyConsumption(data: {
    device_id: number;
    hour_start: Date;
    hour_end: Date;
    total_consumption: number;
    measurement_count: number;
  }): Promise<HourlyEnergyConsumption> {
    const result = await pool.query(
      `INSERT INTO hourly_energy_consumption 
       (device_id, hour_start, hour_end, total_consumption, measurement_count) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (device_id, hour_start) DO UPDATE SET 
         total_consumption = hourly_energy_consumption.total_consumption + $4,
         measurement_count = hourly_energy_consumption.measurement_count + $5
       RETURNING *`,
      [
        data.device_id,
        data.hour_start,
        data.hour_end,
        data.total_consumption,
        data.measurement_count,
      ]
    );
    return result.rows[0];
  }

  async getHourlyConsumptionByUserAndDate(
    userId: number,
    date: Date
  ): Promise<HourlyEnergyConsumption[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await pool.query(
      `SELECT 
        MIN(hec.id) as id,
        MIN(hec.device_id) as device_id,
        md.assigned_user_id as user_id,
        hec.hour_start,
        hec.hour_end,
        SUM(hec.total_consumption) as total_consumption,
        SUM(hec.measurement_count) as measurement_count
       FROM hourly_energy_consumption hec
       INNER JOIN mirrored_devices md ON hec.device_id = md.id
       WHERE md.assigned_user_id = $1 
       AND hec.hour_start >= $2 
       AND hec.hour_start <= $3
       GROUP BY md.assigned_user_id, hec.hour_start, hec.hour_end
       ORDER BY hec.hour_start`,
      [userId, startOfDay, endOfDay]
    );
    return result.rows;
  }

  async getHourlyConsumptionByDeviceAndDate(
    deviceId: number,
    date: Date
  ): Promise<HourlyEnergyConsumption[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await pool.query(
      `SELECT * FROM hourly_energy_consumption 
       WHERE device_id = $1 
       AND hour_start >= $2 
       AND hour_start <= $3
       ORDER BY hour_start`,
      [deviceId, startOfDay, endOfDay]
    );
    return result.rows;
  }
}
