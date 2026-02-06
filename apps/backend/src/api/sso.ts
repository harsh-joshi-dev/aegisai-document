/**
 * SSO API endpoints
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { verifySAMLAssertion, generateSAMLMetadata, SAMLConfig } from '../auth/sso/saml.js';
import { verifyOIDCToken, getOIDCAuthorizationUrl, exchangeCodeForTokens, OIDCConfig } from '../auth/sso/oidc.js';
import { logAuditEvent } from '../compliance/auditLog.js';

const router = Router();

/**
 * SAML: Get metadata
 */
router.get('/saml/metadata', async (req: Request, res: Response) => {
  try {
    // Get config from environment or database
    const config: SAMLConfig = {
      provider: (process.env.SAML_PROVIDER as any) || 'auth0',
      entryPoint: process.env.SAML_ENTRY_POINT || '',
      issuer: process.env.SAML_ISSUER || '',
      cert: process.env.SAML_CERT || '',
      callbackUrl: `${req.protocol}://${req.get('host')}/api/sso/saml/callback`,
    };

    const metadata = generateSAMLMetadata(config);
    res.type('application/xml');
    res.send(metadata);
  } catch (error) {
    console.error('SAML metadata error:', error);
    res.status(500).json({
      error: 'Failed to generate SAML metadata',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * SAML: Callback handler
 */
router.post('/saml/callback', async (req: Request, res: Response) => {
  try {
    const { SAMLResponse } = req.body;
    
    const config: SAMLConfig = {
      provider: (process.env.SAML_PROVIDER as any) || 'auth0',
      entryPoint: process.env.SAML_ENTRY_POINT || '',
      issuer: process.env.SAML_ISSUER || '',
      cert: process.env.SAML_CERT || '',
      callbackUrl: `${req.protocol}://${req.get('host')}/api/sso/saml/callback`,
    };

    const userInfo = await verifySAMLAssertion(SAMLResponse, config);
    
    if (!userInfo) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid SAML assertion',
      });
    }

    // Log SSO login
    await logAuditEvent(
      userInfo.userId,
      'sso_login',
      'auth',
      userInfo.userId,
      { provider: 'saml', method: config.provider },
      req.ip,
      req.get('user-agent'),
      ['soc2']
    );

    // In production, create session or JWT token
    res.json({
      success: true,
      user: userInfo,
      message: 'SAML authentication successful',
    });
  } catch (error) {
    console.error('SAML callback error:', error);
    res.status(500).json({
      error: 'SAML authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * OIDC: Get authorization URL
 */
router.get('/oidc/authorize', async (req: Request, res: Response) => {
  try {
    const state = req.query.state as string || Math.random().toString(36);
    const redirectUri = `${req.protocol}://${req.get('host')}/api/sso/oidc/callback`;

    const config: OIDCConfig = {
      provider: (process.env.OIDC_PROVIDER as any) || 'auth0',
      issuer: process.env.OIDC_ISSUER || '',
      clientId: process.env.OIDC_CLIENT_ID || '',
      clientSecret: process.env.OIDC_CLIENT_SECRET || '',
      jwksUri: process.env.OIDC_JWKS_URI || '',
      authorizationEndpoint: process.env.OIDC_AUTH_ENDPOINT || '',
      tokenEndpoint: process.env.OIDC_TOKEN_ENDPOINT || '',
      userInfoEndpoint: process.env.OIDC_USERINFO_ENDPOINT || '',
    };

    const authUrl = getOIDCAuthorizationUrl(config, redirectUri, state);
    res.redirect(authUrl);
  } catch (error) {
    console.error('OIDC authorize error:', error);
    res.status(500).json({
      error: 'Failed to initiate OIDC flow',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * OIDC: Callback handler
 */
router.get('/oidc/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({
        error: 'Missing authorization code',
      });
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/sso/oidc/callback`;

    const config: OIDCConfig = {
      provider: (process.env.OIDC_PROVIDER as any) || 'auth0',
      issuer: process.env.OIDC_ISSUER || '',
      clientId: process.env.OIDC_CLIENT_ID || '',
      clientSecret: process.env.OIDC_CLIENT_SECRET || '',
      jwksUri: process.env.OIDC_JWKS_URI || '',
      authorizationEndpoint: process.env.OIDC_AUTH_ENDPOINT || '',
      tokenEndpoint: process.env.OIDC_TOKEN_ENDPOINT || '',
      userInfoEndpoint: process.env.OIDC_USERINFO_ENDPOINT || '',
    };

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code as string, config, redirectUri);
    
    // Verify ID token
    const userInfo = await verifyOIDCToken(tokens.idToken, config);
    
    if (!userInfo) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid OIDC token',
      });
    }

    // Log SSO login
    await logAuditEvent(
      userInfo.userId,
      'sso_login',
      'auth',
      userInfo.userId,
      { provider: 'oidc', method: config.provider },
      req.ip,
      req.get('user-agent'),
      ['soc2']
    );

    // In production, create session or JWT token, then redirect to app
    res.json({
      success: true,
      user: userInfo,
      message: 'OIDC authentication successful',
    });
  } catch (error) {
    console.error('OIDC callback error:', error);
    res.status(500).json({
      error: 'OIDC authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
