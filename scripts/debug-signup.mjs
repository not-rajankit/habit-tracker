import pool from '../backend/src/db.js';
import { hashPassword } from '../backend/src/authentication/password.js';
import { attachRolesAndPermissions } from '../backend/src/authentication/rbac.js';
import { trackEvent } from '../backend/src/analytics/events.js';

async function main() {
  try {
    const email = `debug-${Date.now()}@example.com`;
    const passwordHash = await hashPassword('DebugPass123');
    const result = await pool.query(
      `INSERT INTO authentication.users (email, password_hash, name, auth_provider)
       VALUES ($1, $2, $3, 'password')
       ON CONFLICT (email) DO NOTHING
       RETURNING *`,
      [email, passwordHash, 'Debug User']
    );

    console.log('insert rows', result.rows.length);
    if (!result.rows.length) return;

    await pool.query(
      `INSERT INTO authentication.user_roles (user_id, role_id)
       SELECT $1, id FROM authentication.roles WHERE name = 'User'
       ON CONFLICT DO NOTHING`,
      [result.rows[0].id]
    );
    console.log('role ok');

    const user = await attachRolesAndPermissions(result.rows[0]);
    console.log('attach ok', user.roles);

    await trackEvent('user_signed_up', { userId: user.id, metadata: { provider: 'password' } });
    console.log('track ok');
  } catch (err) {
    console.error('DEBUG SIGNUP ERROR');
    console.error(err);
  } finally {
    await pool.end();
  }
}

await main();
