// Environment configuration
// In development, use empty string to leverage Vite's proxy
// In production, use the full backend URL
export const config = {
  apiUrl: import.meta.env.PROD
    ? import.meta.env.VITE_API_URL || "http://localhost:8080"
    : "", // Empty string uses Vite proxy for /api calls
  wsUrl: import.meta.env.VITE_WS_URL || "ws://localhost:3006",
} as const;
