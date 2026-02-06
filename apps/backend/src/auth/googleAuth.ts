import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from '../config/env.js';
import { pool } from '../db/pgvector.js';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  googleId: string;
  createdAt: Date;
}

// Validate Google OAuth configuration
if (!config.google.clientId || !config.google.clientSecret) {
  console.error('⚠️  WARNING: Google OAuth credentials not configured!');
  console.error('   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file');
}

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: config.google.clientId,
      clientSecret: config.google.clientSecret,
      callbackURL: `${config.backendUrl}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const client = await pool.connect();
        try {
          // Check if user exists
          const existingUser = await client.query(
            `SELECT * FROM users WHERE google_id = $1`,
            [profile.id]
          );

          if (existingUser.rows.length > 0) {
            return done(null, existingUser.rows[0]);
          }

          // Create new user
          const newUser = await client.query(
            `INSERT INTO users (email, name, picture, google_id, created_at, welcome_email_sent)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, false)
             RETURNING *`,
            [
              profile.emails?.[0]?.value || '',
              profile.displayName || '',
              profile.photos?.[0]?.value,
              profile.id,
            ]
          );

          // Send welcome email for new user (async, don't block)
          const { sendWelcomeEmail } = await import('../services/emailService.js');
          sendWelcomeEmail(
            profile.emails?.[0]?.value || '',
            profile.displayName || 'User'
          ).catch(err => {
            console.error('Failed to send welcome email:', err);
          });

          // Mark welcome email as sent
          await client.query(
            `UPDATE users SET welcome_email_sent = true WHERE id = $1`,
            [newUser.rows[0].id]
          );

          return done(null, newUser.rows[0]);
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('Google OAuth callback error:', error);
        return done(error, null);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        done(null, result.rows[0]);
      } else {
        done(new Error('User not found'), null);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    done(error, null);
  }
});

export default passport;
