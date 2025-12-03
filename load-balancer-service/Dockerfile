FROM node:18-alpine

# Install Docker CLI for container scaling
RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3008

CMD ["npm", "start"]
