import express from 'express';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { config } from './config/env.js';
import { initializeDatabase, pool } from './db/pgvector.js';
import passport from './auth/googleAuth.js';
import authRouter from './api/auth.js';
import uploadRouter from './api/upload.js';
import documentsRouter from './api/documents.js';
import complianceRouter from './api/compliance.js';
import uliRouter from './api/uli.js';
import loanApplicationsRouter from './api/loanApplications.js';
import rulesRouter from './api/rules.js';
import agentSwarmRouter from './api/agentSwarm.js';
import indicRouter from './api/indic.js';
import pricingRouter from './api/pricing.js';
import serviceProvidersRouter from './api/serviceProviders.js';
import voiceRouter from './api/voice.js';
import chatRouter from './api/chat.js';
import mobileRouter from './api/mobile.js';

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: config.server.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/uli', uliRouter);
app.use('/api/loan-applications', loanApplicationsRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/agent-swarm', agentSwarmRouter);
app.use('/api/indic', indicRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/service-providers', serviceProvidersRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/chat', chatRouter);
app.use('/api/mobile', mobileRouter);

console.log('✅ ULI + DPDP routes: auth, upload, documents, compliance, uli, loan-applications, rules, agent-swarm, indic, pricing, service-providers, voice, chat, mobile');

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.server.nodeEnv === 'development' ? err.message : 'An error occurred',
  });
});

async function start() {
  try {
    await initializeDatabase();
    console.log('Database initialized');
    const { getEmailConfigStatus, verifySMTPConnection } = await import('./services/emailService.js');
    const emailStatus = getEmailConfigStatus();
    if (emailStatus.configured) {
      const ok = await verifySMTPConnection();
      if (!ok) console.warn('📧 SMTP verification failed.');
    } else {
      console.warn('📧 SMTP not configured.');
    }
    const { setupAlertCron, setupDPDPCron } = await import('./alerts/cron.js');
    setupAlertCron();
    setupDPDPCron();
    app.listen(config.server.port, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${config.server.port}`);
      console.log(`📊 ULI + DPDP SME Lending Intelligence Platform`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
