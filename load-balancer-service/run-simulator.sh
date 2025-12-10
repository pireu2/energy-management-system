#!/bin/bash

# Device Simulator Runner
# This script starts the device simulator that creates one simulator per device

cd "$(dirname "$0")"

# Default values
RABBITMQ_URL="${RABBITMQ_URL:-amqp://energy_user:energy_password@localhost:5672}"
DEVICE_SERVICE_URL="${DEVICE_SERVICE_URL:-http://localhost:3003/devices}"
INTERVAL_MS="${INTERVAL_MS:-10000}"

echo "========================================"
echo "  Device Simulator Runner"
echo "========================================"
echo "RabbitMQ URL: $RABBITMQ_URL"
echo "Device Service URL: $DEVICE_SERVICE_URL"
echo "Interval: ${INTERVAL_MS}ms"
echo "========================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build TypeScript if needed
if [ ! -f "dist/simulator.js" ]; then
    echo "Building TypeScript..."
    npm run build
fi

# Export environment variables
export RABBITMQ_URL
export DEVICE_SERVICE_URL
export INTERVAL_MS

# Run the simulator
echo "Starting simulator..."
npm run simulator:prod
