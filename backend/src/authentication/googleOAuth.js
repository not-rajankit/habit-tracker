import crypto from 'crypto';
import { authConfig } from './config.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export function createGoogleState(intent = 'login') {
  return `${intent}:${crypto.randomBytes(24).toString('base64url')}`;
}

export function parseGoogleState(state) {
  const [intent] = String(state || '').split(':');
  return intent === 'link' ? 'link' : 'login';
}

export function getGoogleAuthUrl(state) {
  if (!authConfig.google.clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const params = new URLSearchParams({
    client_id: authConfig.google.clientId,
    redirect_uri: `${authConfig.apiUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeGoogleCode(code) {
  if (!authConfig.google.clientId || !authConfig.google.clientSecret) {
    throw new Error('Google OAuth is not configured');
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: authConfig.google.clientId,
      client_secret: authConfig.google.clientSecret,
      redirect_uri: `${authConfig.apiUrl}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange Google OAuth code');
  }

  const tokenData = await tokenResponse.json();
  const userResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch Google profile');
  }

  return userResponse.json();
}
