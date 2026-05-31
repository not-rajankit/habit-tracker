import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
const sslMode = process.env.PGSSLMODE || '';

let connectionString = databaseUrl;
let shouldUseSsl = ['require', 'verify-ca', 'verify-full'].includes(sslMode);

if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  const urlSslMode = parsed.searchParams.get('sslmode');
  if (urlSslMode) shouldUseSsl = true;
  parsed.searchParams.delete('sslmode');
  connectionString = parsed.toString();
}

const ssl = shouldUseSsl
  ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
  : undefined;

const pool = new pg.Pool({
  connectionString,
  options: "-c timezone=Asia/Kolkata",
  ssl,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;
