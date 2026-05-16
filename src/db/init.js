import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

if (process.env.DATABASE_URL === 'memory://local') {
  console.log('Skipping schema init for in-memory database. The server initializes it on startup.');
  process.exit(0);
}

const pool = createPool();

try {
  const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Database schema is ready.');
} finally {
  await pool.end();
}
