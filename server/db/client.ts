import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as schema from './schema';

const pool = config.DATABASE_URL ? new Pool({ connectionString: config.DATABASE_URL, max: 10 }) : null;
export const db = pool ? drizzle(pool, { schema }) : null;
export async function checkDatabase(): Promise<boolean> {
  if (!pool) return false;
  try { await pool.query('select 1'); return true; } catch { return false; }
}
