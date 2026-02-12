import express from 'express';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { config } from './config/env.js';
import { initializeDatabase, pool } from './db/pgvector.js';
import passport from './auth/googleAuth.js';
import uploadRouter from './api/upload.js';
import chatRouter from './api/chat.js';
import documentsRouter from './api/documents.js';
import compareRouter from './api/compare.js';
import rulesRouter from './api/rules.js';
import templatesRouter from './api/templates.js';
import negotiationRouter from './api/negotiation.js';
import analyticsRouter from './api/analytics.js';
import redactionRouter from './api/redaction.js';
import complianceRouter from './api/compliance.js';
import ssoRouter from './api/sso.js';
import whiteLabelRouter from './api/whiteLabel.js';
import dashboardRouter from './api/dashboard.js';
import benchmarkingRouter from './api/benchmarking.js';
import alertsRouter from './api/alerts.js';
import reportsRouter from './api/reports.js';
import serviceProvidersRouter from './api/serviceProviders.js';
import authRouter from './api/auth.js';
import explainRouter from './api/explain.js';
import translateRouter from './api/translate.js';
import geocodeRouter from './api/geocode.js';
import whatIfRouter from './api/whatIf.js';
import voiceRouter from './api/voice.js';
import trustScoreRouter from './api/trustScore.js';
import agentSwarmRouter from './api/agentSwarm.js';
import mobileRouter from './api/mobile.js';
import completenessRouter from './api/completeness.js';
import foldersRouter from './api/folders.js';
import verifyDocumentRouter from './api/verifyDocument.js';
import financeToolsRouter from './api/financeTools.js';
import actionIntelligenceRouter from './api/actionIntelligence.js';
import deadlinesRouter from './api/deadlines.js';
import financialImpactRouter from './api/financialImpact.js';
import riskClausesRouter from './api/riskClauses.js';
import commentsRouter from './api/comments.js';
import policyMatcherRouter from './api/policyMatcher.js';
import shareSummaryRouter from './api/shareSummary.js';
import scamScoreRouter from './api/scamScore.js';
import draftsRouter from './api/drafts.js';
import uliRouter from './api/uli.js';
import loanApplicationsRouter from './api/loanApplications.js';
import indicRouter from './api/indic.js';
import pricingRouter from './api/pricing.js';

const app = express();

// Required behind Render (or any reverse proxy): so req.secure is true and session cookie gets Secure flag
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true, // Automatically create session table if it doesn't exist
    }),
    secret: config.server.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      // In production with frontend on Netlify and backend on Render, cookie must be SameSite=None so it's sent cross-origin
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Health check
app.get('/health', (_req: express.Request, res: express.Response) => {
  console.log('Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Auth routes (must be before other routes)
app.use('/api/auth', authRouter);

// API routes
app.use('/api/upload', uploadRouter);
app.use('/api/explain', explainRouter);
app.use('/api/translate', translateRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/chat', chatRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/compare', compareRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/negotiation', negotiationRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/redaction', redactionRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/sso', ssoRouter);
app.use('/api/white-label', whiteLabelRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/benchmarking', benchmarkingRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/service-providers', serviceProvidersRouter);
app.use('/api/what-if', whatIfRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/trust-score', trustScoreRouter);
app.use('/api/agent-swarm', agentSwarmRouter);
app.use('/api/mobile', mobileRouter);
app.use('/api/completeness', completenessRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/verify', verifyDocumentRouter);
app.use('/api/finance-tools', financeToolsRouter);
app.use('/api/action-intelligence', actionIntelligenceRouter);
app.use('/api/deadlines', deadlinesRouter);
app.use('/api/financial-impact', financialImpactRouter);
app.use('/api/risk-clauses', riskClausesRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/policy-matcher', policyMatcherRouter);
app.use('/api/share-summary', shareSummaryRouter);
app.use('/api/scam-score', scamScoreRouter);
app.use('/api/drafts', draftsRouter);
app.use('/api/uli', uliRouter);
app.use('/api/loan-applications', loanApplicationsRouter);
app.use('/api/indic', indicRouter);
app.use('/api/pricing', pricingRouter);

// Risk clauses per document (nested under documents in some clients; mount as /api/risk-clauses/:documentId)
// Already mounted as riskClausesRouter with GET /:documentId

// Debug: Log registered routes
console.log('✅ Routes registered: /api/upload, /api/chat, /api/documents, /api/compare, /api/rules, /api/templates, /api/negotiation, /api/analytics, /api/redaction, /api/compliance, /api/sso, /api/white-label, /api/dashboard, /api/benchmarking, /api/alerts, /api/reports, /api/service-providers');

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.server.nodeEnv === 'development' ? err.message : 'An error occurred',
  });
});

// Initialize database and start server
async function start() {
  try {
    await initializeDatabase();
    console.log('Database initialized');

    // Log email (SMTP) status at startup so you can see why emails might not send
    const { getEmailConfigStatus, verifySMTPConnection } = await import('./services/emailService.js');
    const emailStatus = getEmailConfigStatus();
    if (emailStatus.configured) {
      console.log('📧 SMTP configured (SMTP_USER, SMTP_PASSWORD, FROM_EMAIL set). Verifying connection...');
      const ok = await verifySMTPConnection();
      if (!ok) console.warn('📧 SMTP verification failed — check credentials (e.g. Gmail: use App Password, not account password).');
    } else {
      console.warn('📧 SMTP not configured. Missing:', emailStatus.missing.join(', '), '— welcome and document emails will be skipped.');
    }

    const { setupAlertCron, setupDPDPCron } = await import('./alerts/cron.js');
    setupAlertCron();
    setupDPDPCron();
    
    app.listen(config.server.port, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${config.server.port}`);
      console.log(`📊 Environment: ${config.server.nodeEnv}`);
      console.log(`✅ Listening on 0.0.0.0:${config.server.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
