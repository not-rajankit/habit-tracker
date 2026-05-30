import pool from '../db.js';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './config.js';
import { attachRolesAndPermissions } from './rbac.js';
import { rotateRefreshSession } from './sessionService.js';
import { verifyAccessToken } from './tokens.js';

async function getUserForToken(payload) {
  const result = await pool.query(
    `SELECT u.*
     FROM authentication.users u
     JOIN authentication.refresh_tokens rt ON rt.user_id = u.id
     WHERE u.id = $1
       AND rt.id = $2
       AND rt.revoked_at IS NULL
       AND rt.expires_at > NOW()
       AND u.status = 'active'`,
    [payload.sub, payload.token_id]
  );
  if (!result.rows[0]) return null;
  await pool.query(`UPDATE authentication.users SET last_active_at = NOW() WHERE id = $1`, [result.rows[0].id]);
  return attachRolesAndPermissions(result.rows[0]);
}

export async function authenticate(req, res, next) {
  try {
    const accessToken = req.cookies?.[ACCESS_COOKIE];
    if (accessToken) {
      const payload = verifyAccessToken(accessToken);
      const user = await getUserForToken(payload);
      if (user) {
        req.user = user;
        return next();
      }
    }
  } catch {
    // Fall through to refresh-token rotation.
  }

  try {
    const user = await rotateRefreshSession(req.cookies?.[REFRESH_COOKIE], req, res);
    if (user) {
      req.user = user;
      return next();
    }
  } catch (err) {
    console.error('Session refresh failed:', err);
  }

  return res.status(401).json({ error: 'Authentication required' });
}
