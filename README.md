# Energy Management System

A distributed microservices-based Energy Management System that allows authenticated users to access, monitor, and manage smart energy metering devices. Built with containerized microservices architecture using Docker.

## 🏗️ Architecture

The system consists of the following components:

- **Frontend Application**: React + TypeScript + Tailwind CSS web interface
- **API Gateway**: Nginx reverse proxy for request routing and load balancing
- **Authentication Service**: Handles user authentication and JWT token management
- **User Management Service**: Manages user profiles and role-based access
- **Device Management Service**: Handles energy device CRUD operations
- **PostgreSQL Database**: Persistent data storage for all services

## 🚀 Features

### User Roles

- **Administrator**: Full CRUD operations on users, devices, and user-device associations
- **Client**: View devices assigned to their account

### Services

- **User Service**: Profile management (email, firstName, lastName, role)
- **Auth Service**: Secure authentication with JWT tokens
- **Device Service**: Energy device management with consumption tracking
- **API Gateway**: Centralized routing, authentication, and authorization

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT tokens
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx
- **API Documentation**: Swagger

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- npm or yarn

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
```

### 2. Start the database

```bash
docker-compose up postgres -d
```

### 3. Run all services

```bash
# Using Docker (recommended)
docker-compose up

# Or for development (requires multiple terminals)
# Terminal 1 - User Service
cd user-service && npm install && npm run dev

# Terminal 2 - Auth Service
cd auth-service && npm install && npm run dev

# Terminal 3 - Device Service
cd device-service && npm install && npm run dev

# Terminal 4 - Frontend
cd frontend && npm install && npm run dev
```

### 4. Access the application

- Frontend: http://localhost:3000
- User Service: http://localhost:3001
- Auth Service: http://localhost:3002
- Device Service: http://localhost:3003
- Database: localhost:5433 (PostgreSQL)

## 🗄️ Database Setup

The system uses PostgreSQL with separate databases for each service:

- `user_management` - User profiles
- `auth_db` - Authentication credentials
- `device_management` - Device information

Database initialization happens automatically via Docker init scripts.

## 📡 API Endpoints

### User Service (Port 3001)

```
GET    /health                 - Health check
GET    /users                  - Get all users
GET    /users/:id              - Get user by ID
GET    /users/email/:email     - Get user by email
POST   /users                  - Create user
PUT    /users/:id              - Update user
DELETE /users/:id              - Delete user
```

### Auth Service (Port 3002)

```
POST   /auth/login             - User login
POST   /auth/register          - User registration
POST   /auth/refresh           - Refresh JWT token
POST   /auth/logout            - User logout
```

### Device Service (Port 3003)

```
GET    /devices                - Get all devices
GET    /devices/:id            - Get device by ID
POST   /devices                - Create device
PUT    /devices/:id            - Update device
DELETE /devices/:id            - Delete device
GET    /devices/user/:userId   - Get devices by user
```

## 🐳 Docker Services

### Available Docker Commands

```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up postgres
docker-compose up user-service

# Build and start
docker-compose up --build

# Stop all services
docker-compose down

# View logs
docker-compose logs user-service
```

### Service Configuration

Each service has its own Dockerfile and can be deployed independently:

- `user-service/Dockerfile`
- `auth-service/Dockerfile`
- `device-service/Dockerfile`

## 🔧 Development

### Environment Variables

Each service uses environment variables for configuration:

**User Service (.env)**

```
DB_HOST=localhost
DB_PORT=5433
DB_NAME=user_management
DB_USER=energy_user
DB_PASSWORD=energy_password
PORT=3001
NODE_ENV=development
```

### TypeORM Configuration

- Automatic table synchronization in development
- Entity-based database modeling
- Migration support for production

### Code Structure

```
service-name/
├── src/
│   ├── index.ts          # Entry point
│   ├── config/           # Database and app configuration
│   ├── controllers/      # Request handlers
│   ├── models/           # TypeORM entities and repositories
│   ├── routes/           # Express route definitions
│   └── middleware/       # Custom middleware
├── Dockerfile
├── package.json
└── tsconfig.json
```

## 🧪 Testing

### API Testing with curl

```bash
# Test user service
curl http://localhost:3001/health

# Create a user
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  }'
```

## 🔐 Security

- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Environment variable configuration
- Docker network isolation

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Duica Sebastian

**Note**: This is an educational project developed for learning distributed systems concepts and microservices architecture.
