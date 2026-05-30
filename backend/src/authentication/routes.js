import { Router } from 'express';
import pool from '../db.js';
import { ACCESS_COOKIE, GOOGLE_STATE_COOKIE, authConfig } from './config.js';
import { authenticate } from './middleware.js';
import { hashPassword, isValidEmail, normalizeEmail, validatePassword, verifyPassword } from './password.js';
import { authRateLimit, strictAuthRateLimit } from './rateLimiters.js';
import { createSession, publicUser, revokeRefreshToken, rotateRefreshSession } from './sessionService.js';
import { clearGoogleStateCookie, clearSessionCookies, createOpaqueToken, hashToken, setGoogleStateCookie, verifyAccessToken } from './tokens.js';
import { createGoogleState, exchangeGoogleCode, getGoogleAuthUrl, parseGoogleState } from './googleOAuth.js';
import { attachRolesAndPermissions } from './rbac.js';
import { trackEvent } from '../analytics/events.js';

const router = Router();

function redirectAuthResult(res, status, reason = '') {
  const params = new URLSearchParams({ status });
  if (reason) params.set('reason', reason);
  res.redirect(`${authConfig.frontendUrl}/auth/callback?${params}`);
}

async function currentUserFromRequest(req) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return null;
  const payload = verifyAccessToken(token);
  const result = await pool.query(`SELECT * FROM authentication.users WHERE id = $1`, [payload.sub]);
  return result.rows[0] || null;
}

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/refresh', authRateLimit, async (req, res) => {
  try {
    const user = await rotateRefreshSession(req.cookies?.refresh_token, req, res);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('Refresh failed:', err);
    res.status(401).json({ error: 'Authentication required' });
  }
});

router.post('/signup', strictAuthRateLimit, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { name, password } = req.body;
    const passwordError = validatePassword(password);

    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (passwordError) return res.status(400).json({ error: passwordError });

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO authentication.users (email, password_hash, name, auth_provider)
       VALUES ($1, $2, $3, 'password')
       ON CONFLICT (email) DO NOTHING
       RETURNING *`,
      [email, passwordHash, name?.trim() || email.split('@')[0]]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'An account already exists for this email.' });
    }

    await pool.query(
      `INSERT INTO authentication.user_roles (user_id, role_id)
       SELECT $1, id FROM authentication.roles WHERE name = 'User'
       ON CONFLICT DO NOTHING`,
      [result.rows[0].id]
    );
    const user = await attachRolesAndPermissions(result.rows[0]);
    await trackEvent('user_signed_up', { userId: user.id, metadata: { provider: 'password' } });
    await createSession(user, req, res);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error('Signup failed:', err);
    res.status(500).json({ error: 'Could not create account' });
  }
});

router.post('/login', strictAuthRateLimit, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    const result = await pool.query(`SELECT * FROM authentication.users WHERE email = $1`, [email]);
    const user = result.rows[0];
    const valid = user ? await verifyPassword(password, user.password_hash) : false;
    if (!valid) {
      await trackEvent('login_failed', { metadata: { reason: 'invalid_credentials' } });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.status === 'suspended') {
      await trackEvent('login_failed', { userId: user.id, metadata: { reason: 'suspended' } });
      return res.status(403).json({ error: 'Account is suspended.' });
    }

    const userWithAccess = await attachRolesAndPermissions(user);
    await trackEvent('login_success', { userId: user.id, metadata: { provider: 'password' } });
    await createSession(userWithAccess, req, res);
    res.json({ user: publicUser(userWithAccess) });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Could not sign in' });
  }
});

router.post('/logout', authRateLimit, async (req, res) => {
  try {
    await revokeRefreshToken(req.cookies?.refresh_token);
    clearSessionCookies(res);
    res.json({ ok: true });
  } catch (err) {
    console.error('Logout failed:', err);
    res.status(500).json({ error: 'Could not sign out' });
  }
});

router.get('/google', authRateLimit, (req, res) => {
  try {
    const state = createGoogleState(req.query.intent);
    setGoogleStateCookie(res, state);
    res.redirect(getGoogleAuthUrl(state));
  } catch (err) {
    console.error('Google OAuth start failed:', err);
    redirectAuthResult(res, 'error', 'google_unavailable');
  }
});

router.get('/google/callback', authRateLimit, async (req, res) => {
  try {
    const { code, state } = req.query;
    const expectedState = req.cookies?.[GOOGLE_STATE_COOKIE];
    clearGoogleStateCookie(res);

    if (!code || !state || !expectedState || state !== expectedState) {
      return redirectAuthResult(res, 'error', 'invalid_state');
    }

    const intent = parseGoogleState(state);
    const profile = await exchangeGoogleCode(code);
    const email = normalizeEmail(profile.email);
    if (!profile.email_verified || !isValidEmail(email)) {
      return redirectAuthResult(res, 'error', 'email_unverified');
    }

    if (intent === 'link') {
      const currentUser = await currentUserFromRequest(req);
      if (!currentUser) return redirectAuthResult(res, 'error', 'login_required');
      if (currentUser.email !== email) return redirectAuthResult(res, 'error', 'email_mismatch');

      await pool.query(
        `UPDATE authentication.users
         SET google_id = $1,
             name = COALESCE(NULLIF(name, ''), $2),
             avatar_url = COALESCE($3, avatar_url),
             auth_provider = CASE WHEN password_hash IS NULL THEN 'google' ELSE 'hybrid' END,
             updated_at = NOW()
         WHERE id = $4`,
        [profile.sub, profile.name || currentUser.name, profile.picture || null, currentUser.id]
      );
      return redirectAuthResult(res, 'success');
    }

    const result = await pool.query(
      `INSERT INTO authentication.users (email, google_id, name, avatar_url, auth_provider)
       VALUES ($1, $2, $3, $4, 'google')
       ON CONFLICT (email) DO UPDATE SET
         google_id = COALESCE(authentication.users.google_id, EXCLUDED.google_id),
         name = COALESCE(EXCLUDED.name, authentication.users.name),
         avatar_url = COALESCE(EXCLUDED.avatar_url, authentication.users.avatar_url),
         auth_provider = CASE WHEN authentication.users.password_hash IS NULL THEN 'google' ELSE 'hybrid' END,
         updated_at = NOW()
       RETURNING *`,
      [email, profile.sub, profile.name || email.split('@')[0], profile.picture || null]
    );

    await pool.query(
      `INSERT INTO authentication.user_roles (user_id, role_id)
       SELECT $1, id FROM authentication.roles WHERE name = 'User'
       ON CONFLICT DO NOTHING`,
      [result.rows[0].id]
    );
    const user = await attachRolesAndPermissions(result.rows[0]);
    await trackEvent('login_success', { userId: user.id, metadata: { provider: 'google' } });
    await createSession(user, req, res);
    redirectAuthResult(res, 'success');
  } catch (err) {
    console.error('Google OAuth callback failed:', err);
    redirectAuthResult(res, 'error', 'google_failed');
  }
});

router.put('/me', authenticate, async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : req.user.name;
    const result = await pool.query(
      `UPDATE authentication.users
       SET name = COALESCE(NULLIF($1, ''), name), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [name, req.user.id]
    );
    res.json({ user: publicUser(await attachRolesAndPermissions(result.rows[0])) });
  } catch (err) {
    console.error('Profile update failed:', err);
    res.status(500).json({ error: 'Could not update profile' });
  }
});

router.post('/password/change', authenticate, strictAuthRateLimit, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const passwordError = validatePassword(new_password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    if (req.user.password_hash) {
      const valid = await verifyPassword(current_password, req.user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const passwordHash = await hashPassword(new_password);
    const result = await pool.query(
      `UPDATE authentication.users
       SET password_hash = $1,
           auth_provider = CASE WHEN google_id IS NULL THEN 'password' ELSE 'hybrid' END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [passwordHash, req.user.id]
    );
    res.json({ user: publicUser(await attachRolesAndPermissions(result.rows[0])) });
  } catch (err) {
    console.error('Password change failed:', err);
    res.status(500).json({ error: 'Could not update password' });
  }
});

router.post('/password/forgot', strictAuthRateLimit, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const generic = { message: 'If an account exists, password recovery instructions are available.' };
    if (!isValidEmail(email)) return res.json(generic);

    const userResult = await pool.query(`SELECT * FROM authentication.users WHERE email = $1`, [email]);
    const user = userResult.rows[0];
    if (!user) return res.json(generic);

    if (!user.password_hash && user.google_id) {
      console.log(`Password recovery for ${email}: account uses Google. Sign in with Google, then set a password from Profile.`);
      return res.json(generic);
    }

    const token = createOpaqueToken();
    await pool.query(
      `INSERT INTO authentication.password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
      [user.id, hashToken(token)]
    );
    console.log(`Password reset link for ${email}: ${authConfig.frontendUrl}/reset-password?token=${token}`);
    res.json(generic);
  } catch (err) {
    console.error('Forgot password failed:', err);
    res.status(500).json({ error: 'Could not start password recovery' });
  }
});

router.post('/password/reset', strictAuthRateLimit, async (req, res) => {
  try {
    const { token, password } = req.body;
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const tokenHash = hashToken(token || '');
    const tokenResult = await pool.query(
      `SELECT prt.id AS reset_token_id, u.*
       FROM authentication.password_reset_tokens prt
       JOIN authentication.users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Reset link is invalid or expired.' });
    }

    const user = tokenResult.rows[0];
    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE authentication.users
         SET password_hash = $1,
             auth_provider = CASE WHEN google_id IS NULL THEN 'password' ELSE 'hybrid' END,
             updated_at = NOW()
        WHERE id = $2`,
        [passwordHash, user.id]
      );
      await client.query(
        `UPDATE authentication.password_reset_tokens
         SET used_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [user.reset_token_id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Password reset failed:', err);
    res.status(500).json({ error: 'Could not reset password' });
  }
});

export default router;
