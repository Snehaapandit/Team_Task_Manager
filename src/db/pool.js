import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { newDb } from 'pg-mem';
import crypto from 'node:crypto';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createMemoryPool() {
  const db = newDb();
  db.public.registerFunction({
    name: 'uuid_generate_v4',
    returns: 'uuid',
    impure: true,
    implementation: () => crypto.randomUUID()
  });
  db.public.registerFunction({ name: 'trim', args: ['text'], returns: 'text', implementation: (value) => String(value).trim() });
  db.public.registerFunction({ name: 'char_length', args: ['text'], returns: 'integer', implementation: (value) => String(value).length });

  const schema = fs
    .readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
    .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '');
  db.public.none(schema);

  const adapter = db.adapters.createPg();
  return new adapter.Pool();
}

export function createPool() {
  if (process.env.DATABASE_URL === 'memory://local') {
    console.warn('Using in-memory development database. Data resets when the server stops.');
    return createMemoryPool();
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}
