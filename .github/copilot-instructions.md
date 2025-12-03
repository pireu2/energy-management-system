# Copilot Instructions for Energy Management System

## Project Overview

This is a distributed microservices-based Energy Management System built with Node.js, TypeScript, and Docker. The system allows authenticated users to access, monitor, and manage smart energy metering devices.

## Architecture

### Services

| Service            | Port  | Description                              |
| ------------------ | ----- | ---------------------------------------- |
| Frontend           | 3000  | React + TypeScript + Tailwind CSS        |
| User Service       | 3001  | User profile management                  |
| Auth Service       | 3002  | JWT authentication                       |
| Device Service     | 3003  | Device CRUD operations                   |
| Swagger Service    | 3004  | API documentation                        |
| Monitoring Service | 3005  | Energy consumption monitoring            |
| WebSocket Service  | 3006  | Real-time notifications & chat transport |
| Chat Service       | 3007  | Customer support (rule-based & AI)       |
| Load Balancer      | 3008  | Device data distribution to replicas     |
| API Gateway        | 8080  | Nginx reverse proxy                      |
| RabbitMQ Dashboard | 15672 | Message queue management UI              |

### Databases (PostgreSQL 15)

| Database          | Port | Purpose                    |
| ----------------- | ---- | -------------------------- |
| auth_db           | 5434 | Authentication credentials |
| user_management   | 5435 | User profiles              |
| device_management | 5436 | Device information         |
| monitoring_db     | 5437 | Energy measurements        |
| chat_db           | 5438 | Chat sessions & messages   |

### Message Queue

- **RabbitMQ** with fanout exchange pattern (`sync_exchange`)
- Queues:
  - `sync_queue_device_service` - Device service sync
  - `sync_queue_monitoring_service` - Monitoring service sync
  - `device_data_queue` - Raw device measurements
  - `ingest_queue_N` - Load-balanced queues per replica
  - `notifications_queue` - Real-time notifications
  - `chat_messages_queue` - Chat message transport

## Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database ORM**: TypeORM (user, auth, device services), pg Pool (monitoring, chat services)
- **Frontend**: React 19, Vite, Tailwind CSS, shadcn/ui
- **Authentication**: JWT (access + refresh tokens)
- **Message Queue**: RabbitMQ with amqplib
- **WebSocket**: ws library for real-time communication
- **AI Integration**: Hugging Face Inference API (Mistral-7B-Instruct-v0.2)
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx

## Code Style Guidelines

### General Rules

1. Use TypeScript with strict typing
2. Keep logging minimal - only errors and service startup messages
3. No excessive debug statements or verbose logging
4. Use async/await for asynchronous operations
5. Handle errors with try/catch blocks
6. Do not use any type assertions (`as` keyword) unless absolutely necessary
7. Follow ES6+ syntax and features

### File Structure

```
service-name/
├── src/
│   ├── index.ts           # Entry point
│   ├── config/            # Database, RabbitMQ configuration
│   ├── controllers/       # Request handlers
│   ├── models/            # TypeORM entities and repositories
│   ├── routes/            # Express route definitions
│   ├── middleware/        # Custom middleware
│   └── consumers/         # RabbitMQ consumers (if applicable)
├── Dockerfile
├── package.json
└── tsconfig.json
```

### Naming Conventions

- Files: `camelCase.ts` for modules, `PascalCase.ts` for classes/entities
- Variables/Functions: `camelCase`
- Classes/Interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Database tables: `snake_case`

### RabbitMQ Event Types

```typescript
type SyncEventType =
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "device_created"
  | "device_updated"
  | "device_deleted";
```

## Development Commands

```bash
# Start all services
docker-compose up --build -d

# Stop all services
docker-compose down

# View logs for a specific service
docker-compose logs -f <service-name>

# Rebuild a specific service
docker-compose up --build <service-name>

# Access database
docker-compose exec postgres-device psql -U energy_user -d device_management
```

## Database Credentials

All services use the same credentials:

- **User**: `energy_user`
- **Password**: `energy_password`

## User Roles

- **admin**: Full CRUD operations on users, devices, and associations
- **client**: View devices assigned to their account only

## API Authentication

All protected endpoints require:

```
Authorization: Bearer <access_token>
```

Tokens are obtained via `/auth/login` and refreshed via `/auth/refresh`.

## Important Patterns

### Data Synchronization

Services maintain mirrored copies of data they need:

- Device Service mirrors users from User Service
- Monitoring Service mirrors users and devices

Synchronization happens via RabbitMQ fanout exchange - all consumers receive every message.

### Error Handling

```typescript
try {
  // operation
} catch (error) {
  console.error("Descriptive error message:", error);
  // handle or rethrow
}
```

### Repository Pattern

Each entity has a corresponding repository class for database operations:

- `UserRepository`
- `DeviceRepository`
- `MirroredUserRepository`
- `MirroredDeviceRepository`
- `MeasurementRepository`

### Chat Service Rules

The chat service includes 14 rule-based responses covering:

- Greetings and farewells
- Device management help
- Consumption monitoring
- Alert/notification information
- Account and password help
- Admin features
- Error troubleshooting
- Billing questions
- API documentation
- Escalation to human support

When no rule matches, the service falls back to AI (Hugging Face Mistral-7B).

### Load Balancing

The load balancer distributes device data across monitoring service replicas using:

- Round-robin (default)
- Least-loaded
- Consistent hashing (by device ID)

### WebSocket Notifications

Real-time notifications are pushed via WebSocket for:

- Overconsumption alerts (when device exceeds hourly limit)
- Chat messages between users and admins

## Testing Endpoints

```bash
# Health checks
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Auth Service
curl http://localhost:3003/health  # Device Service
curl http://localhost:3005/        # Monitoring Service
curl http://localhost:3006/health  # WebSocket Service
curl http://localhost:3007/health  # Chat Service
curl http://localhost:3008/health  # Load Balancer
```

## Common Issues

1. **RabbitMQ connection fails**: Ensure RabbitMQ container is healthy before starting services
2. **Database sync issues**: Check that fanout exchange and queues are properly bound in RabbitMQ dashboard (http://localhost:15672)
3. **Port conflicts**: Ensure ports 3000-3008, 5434-5438, 5672, 8080, 15672 are available
4. **WebSocket connection fails**: Ensure JWT token is valid and passed as query parameter
5. **AI responses slow**: Hugging Face free tier has rate limits; rule-based responses are instant
