import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { hashPassword } from './password.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');
const credentialsPath = path.join(rootDir, 'dummy-user-credentials.txt');

const DUMMY_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'dummy.user@example.test',
  password: 'Dummy@12345',
  name: 'Dummy User',
};

export async function ensureDummyUserCredentials() {
  const result = await pool.query(
    `SELECT id, password_hash FROM authentication.users WHERE id = $1`,
    [DUMMY_USER.id]
  );

  if (result.rows.length === 0) return;

  if (!result.rows[0].password_hash) {
    const passwordHash = await hashPassword(DUMMY_USER.password);
    await pool.query(
      `UPDATE authentication.users
       SET email = $1,
           name = $2,
           password_hash = $3,
           auth_provider = 'password',
           updated_at = NOW()
       WHERE id = $4`,
      [DUMMY_USER.email, DUMMY_USER.name, passwordHash, DUMMY_USER.id]
    );
  }

  const content = [
    'Dummy migrated user credentials',
    '',
    `Email: ${DUMMY_USER.email}`,
    `Password: ${DUMMY_USER.password}`,
    '',
    'Existing pre-auth dummy data is assigned to this account.',
    'Use this only for local/dev migration data.',
    '',
  ].join('\n');

  fs.writeFileSync(credentialsPath, content, { mode: 0o600 });
}
