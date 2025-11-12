# Device Data Simulator

This application simulates smart meter readings for energy management devices.

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
RABBITMQ_URL=amqp://energy_user:energy_password@localhost:5672
DEVICE_ID=1
INTERVAL_MS=600000
BASE_LOAD=0.5
MAX_VARIATION=0.3
```

- `RABBITMQ_URL`: RabbitMQ connection URL
- `DEVICE_ID`: The ID of the device to simulate (must exist in the system)
- `INTERVAL_MS`: Interval between measurements in milliseconds (default: 600000 = 10 minutes)
- `BASE_LOAD`: Base energy consumption in kWh for 10 minutes
- `MAX_VARIATION`: Maximum random variation in kWh

## Installation

```bash
npm install
```

## Usage

### Development mode:

```bash
npm run dev
```

### Production mode:

```bash
npm run build
npm start
```

## How it works

The simulator generates realistic energy consumption patterns:

- Lower consumption during night hours (0-5 AM)
- Rising consumption in the morning (6-9 AM)
- Moderate consumption during the day (10-16 PM)
- Peak consumption in the evening (18-21 PM)
- Decreasing consumption at night (22-23 PM)

Each measurement includes:

- `timestamp`: ISO 8601 formatted timestamp
- `device_id`: The device identifier
- `measurement_value`: Energy consumed in the 10-minute interval (kWh)

Messages are sent to the RabbitMQ queue `device_data_queue`.
