import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { authConfig, ACCESS_COOKIE, REFRESH_COOKIE, GOOGLE_STATE_COOKIE } from './config.js';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createOpaqueToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function signAccessToken(user, refreshTokenId) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      token_id: refreshTokenId,
    },
    authConfig.accessTokenSecret,
    { expiresIn: authConfig.accessTokenTtl }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, authConfig.accessTokenSecret);
}

export function setSessionCookies(res, accessToken, refreshToken) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...authConfig.cookie,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...authConfig.cookie,
    maxAge: authConfig.refreshTokenDays * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookies(res) {
  res.clearCookie(ACCESS_COOKIE, authConfig.cookie);
  res.clearCookie(REFRESH_COOKIE, authConfig.cookie);
}

export function setGoogleStateCookie(res, value) {
  res.cookie(GOOGLE_STATE_COOKIE, value, {
    ...authConfig.cookie,
    maxAge: 10 * 60 * 1000,
  });
}

export function clearGoogleStateCookie(res) {
  res.clearCookie(GOOGLE_STATE_COOKIE, authConfig.cookie);
}
