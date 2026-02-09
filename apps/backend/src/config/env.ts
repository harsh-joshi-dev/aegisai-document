import dotenv from 'dotenv';

dotenv.config();

export const config = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/aegis_ai',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  google: {
    placesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    sessionSecret: process.env.SESSION_SECRET || 'aegis-ai-secret-key-change-in-production',
  },
  cors: {
    // In production use CORS_ORIGIN or fall back to FRONTEND_URL so cookie + credentials work from frontend origin
    origin:
      process.env.CORS_ORIGIN ||
      (process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL || 'http://localhost:5173' : true),
  },
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  backendUrl: (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, ''),
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    fromEmail: process.env.FROM_EMAIL || '',
  },
} as const;
