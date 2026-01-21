# CI/CD Workflows

This directory contains GitHub Actions workflows for automated deployment.

## Workflows

### 1. `deploy-with-ngrok.yml`

Builds and deploys services in GitHub Actions runner with ngrok tunnel.

**Use case:** Testing, temporary demos
**Limitations:** Workflow stays running to keep ngrok alive

### 2. `deploy-to-server.yml` (Recommended)

Deploys to a persistent remote server with ngrok running in tmux.

**Use case:** Development, staging environments with persistent access

## Setup Instructions

### Required GitHub Secrets

Add these in your repository: Settings → Secrets → Actions

#### For Ngrok:

- `NGROK_AUTHTOKEN`: Your ngrok auth token (get from https://dashboard.ngrok.com/)

#### For Remote Server Deployment (deploy-to-server.yml):

- `SERVER_HOST`: Your server IP or hostname
- `SERVER_USER`: SSH username
- `SSH_PRIVATE_KEY`: SSH private key for authentication
- `DEPLOY_PATH`: Path to project on server (e.g., `/home/user/energy-system`)

#### For Vercel Frontend Auto-Update (optional):

- `VERCEL_TOKEN`: Vercel API token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

### Getting Vercel Credentials

```bash
# Install Vercel CLI
npm i -g vercel

# Login and link project
cd frontend
vercel link

# Get org and project IDs
cat .vercel/project.json
```

### Server Setup

On your deployment server:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Configure ngrok
ngrok config add-authtoken YOUR_TOKEN

# Install tmux
sudo apt install tmux

# Clone repository
git clone YOUR_REPO_URL
cd YOUR_PROJECT
```

## Manual Deployment

### Start services with ngrok:

```bash
# Start services
docker-compose up -d

# Start ngrok in tmux
tmux new -d -s ngrok 'ngrok http 8080'

# Check ngrok URL
curl http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url'
```

### Update Vercel environment:

```bash
export NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')

vercel env rm VITE_API_URL production --yes
echo "$NGROK_URL" | vercel env add VITE_API_URL production

vercel env rm VITE_WS_URL production --yes
echo "${NGROK_URL/https/wss}/ws" | vercel env add VITE_WS_URL production

cd frontend && vercel --prod
```

## Production Considerations

⚠️ **Ngrok free tier limitations:**

- URLs change when ngrok restarts
- Connection limits apply
- Not recommended for production

### Production Alternatives:

1. **Use Render/Heroku/Railway** for persistent deployments
2. **Get a static domain** with ngrok paid plans
3. **Use a VPS with a real domain** and SSL certificates

## Monitoring

Check deployment status:

- GitHub Actions: Repository → Actions tab
- Ngrok dashboard: http://localhost:4040 (on server)
- Service logs: `docker-compose logs -f`
