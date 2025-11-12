export interface DeviceMeasurement {
  id?: number;
  device_id: number;
  timestamp: Date;
  measurement_value: number;
  created_at?: Date;
}

export interface HourlyEnergyConsumption {
  id?: number;
  device_id: number;
  user_id?: number;
  hour_start: Date;
  hour_end: Date;
  total_consumption: number;
  measurement_count: number;
  created_at?: Date;
  updated_at?: Date;
}
