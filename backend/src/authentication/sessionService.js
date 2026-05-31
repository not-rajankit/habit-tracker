import net from 'net';
import pool from '../db.js';
import { authConfig } from './config.js';
import { attachRolesAndPermissions } from './rbac.js';
import { createOpaqueToken, hashToken, setSessionCookies, signAccessToken } from './tokens.js';

function getRequestIp(req) {
  const forwarded = req.get('x-forwarded-for');
  const candidate = forwarded ? forwarded.split(',')[0].trim() : req.ip;
  return net.isIP(candidate) ? candidate : null;
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_url,
    auth_provider: row.auth_provider,
    has_password: Boolean(row.password_hash),
    google_linked: Boolean(row.google_id),
    status: row.status,
    last_active_at: row.last_active_at,
    roles: row.roles || [],
    permissions: row.permissions || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createSession(user, req, res) {
  if (user.status === 'suspended') {
    throw new Error('Account is suspended.');
  }

  const refreshToken = createOpaqueToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + authConfig.refreshTokenDays * 24 * 60 * 60 * 1000);

  const result = await pool.query(
    `INSERT INTO authentication.refresh_tokens
       (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [user.id, refreshTokenHash, req.get('user-agent') || null, getRequestIp(req), expiresAt.toISOString()]
  );

  const accessToken = signAccessToken(user, result.rows[0].id);
  setSessionCookies(res, accessToken, refreshToken);
  await pool.query(`UPDATE authentication.users SET last_active_at = NOW() WHERE id = $1`, [user.id]);
}

export async function rotateRefreshSession(refreshToken, req, res) {
  if (!refreshToken) return null;
  const tokenHash = hashToken(refreshToken);
  const existing = await pool.query(
    `SELECT rt.id, rt.user_id, rt.expires_at, u.*
     FROM authentication.refresh_tokens rt
     JOIN authentication.users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1
       AND rt.revoked_at IS NULL
       AND rt.expires_at > NOW()`,
    [tokenHash]
  );

  if (existing.rows.length === 0) return null;

  const row = existing.rows[0];
  if (row.status === 'suspended') return null;

  await pool.query(
    `UPDATE authentication.refresh_tokens
     SET revoked_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [row.id]
  );

  await createSession(row, req, res);
  return attachRolesAndPermissions(row);
}

export async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return;
  await pool.query(
    `UPDATE authentication.refresh_tokens
     SET revoked_at = NOW(), updated_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(refreshToken)]
  );
}
