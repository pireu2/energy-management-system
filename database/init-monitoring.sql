
CREATE TABLE IF NOT EXISTS mirrored_users (
    id INTEGER PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mirrored_devices (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    maximum_consumption DECIMAL(10, 2) NOT NULL,
    assigned_user_id INTEGER REFERENCES mirrored_users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_measurements (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES mirrored_devices(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    measurement_value DECIMAL(10, 3) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_device_timestamp UNIQUE (device_id, timestamp)
);

CREATE TABLE IF NOT EXISTS hourly_energy_consumption (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES mirrored_devices(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES mirrored_users(id),
    hour_start TIMESTAMP NOT NULL,
    hour_end TIMESTAMP NOT NULL,
    total_consumption DECIMAL(10, 3) NOT NULL,
    measurement_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_device_hour UNIQUE (device_id, hour_start)
);

CREATE INDEX idx_measurements_device_timestamp ON device_measurements(device_id, timestamp);
CREATE INDEX idx_hourly_device_hour ON hourly_energy_consumption(device_id, hour_start);
CREATE INDEX idx_hourly_user_hour ON hourly_energy_consumption(user_id, hour_start);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hourly_consumption_updated_at
BEFORE UPDATE ON hourly_energy_consumption
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
