#!/bin/bash


DEVICE_SERVICE_URL="${DEVICE_SERVICE_URL:-http://localhost:3003/devices}"

echo "Fetching devices from $DEVICE_SERVICE_URL..."

DEVICES=$(curl -s "$DEVICE_SERVICE_URL" | jq -r '.[].id')

if [ -z "$DEVICES" ]; then
    echo "No devices found or failed to fetch devices"
    exit 1
fi

echo "Found devices: $DEVICES"

echo "Stopping existing device-specific monitoring containers..."
docker ps -a --filter "name=energy-monitoring-device-" -q | xargs -r docker rm -f

for DEVICE_ID in $DEVICES; do
    CONTAINER_NAME="energy-monitoring-device-${DEVICE_ID}"
    
    echo "Starting monitoring service for device $DEVICE_ID..."
    
    docker run -d \
        --name "$CONTAINER_NAME" \
        --network assignment1_energy-network \
        -e DB_HOST=host.docker.internal \
        -e DB_PORT=5437 \
        -e DB_NAME=monitoring_db \
        -e DB_USER=energy_user \
        -e DB_PASSWORD=energy_password \
        -e PORT=3005 \
        -e NODE_ENV=development \
        -e RABBITMQ_URL=amqp://energy_user:energy_password@rabbitmq:5672 \
        -e DEVICE_ID="$DEVICE_ID" \
        --add-host=host.docker.internal:host-gateway \
        --restart unless-stopped \
        assignment1-monitoring-service
    
    echo "Started $CONTAINER_NAME"
done

echo ""
echo "Running monitoring containers:"
docker ps --filter "name=energy-monitoring" --format "table {{.Names}}\t{{.Status}}"
