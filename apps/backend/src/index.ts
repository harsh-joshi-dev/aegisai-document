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
import compareFinancialRouter from './api/compareFinancial.js';
import reportRouter from './api/report.js';
import insightsRouter from './api/insights.js';
import workspacesRouter from './api/workspaces.js';
import dashboardRouter from './api/dashboard.js';
import foldersRouter from './api/folders.js';
import geocodeRouter from './api/geocode.js';
import explainRouter from './api/explain.js';
import whatIfRouter from './api/whatIf.js';
import trustScoreRouter from './api/trustScore.js';
import financeToolsRouter from './api/financeTools.js';
import actionIntelligenceRouter from './api/actionIntelligence.js';
import deadlinesRouter from './api/deadlines.js';
import financialImpactRouter from './api/financialImpact.js';
import commentsRouter from './api/comments.js';
import policyMatcherRouter from './api/policyMatcher.js';
import shareSummaryRouter from './api/shareSummary.js';
import scamScoreRouter from './api/scamScore.js';
import draftsRouter from './api/drafts.js';
import negotiationRouter from './api/negotiation.js';
import riskAnalyzeRouter from './api/riskAnalyze.js';

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
      sameSite: 'lax' as const,
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
app.use('/api/compare', compareFinancialRouter);
app.use('/api/report', reportRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/explain', explainRouter);
app.use('/api/what-if', whatIfRouter);
app.use('/api/trust-score', trustScoreRouter);
app.use('/api/finance-tools', financeToolsRouter);
app.use('/api/action-intelligence', actionIntelligenceRouter);
app.use('/api/deadlines', deadlinesRouter);
app.use('/api/financial-impact', financialImpactRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/policy-matcher', policyMatcherRouter);
app.use('/api/share-summary', shareSummaryRouter);
app.use('/api/scam-score', scamScoreRouter);
app.use('/api/drafts', draftsRouter);
app.use('/api/negotiation', negotiationRouter);
app.use('/api/risk', riskAnalyzeRouter);

console.log('✅ All API routes registered');

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
