import path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { app } from './app';
import { config } from './config';

// Migrations folder is always at <project-root>/server/db/migrations.
// Using process.cwd() (the project root) instead of __dirname so the path
// stays correct whether the file is run directly with tsx or relocated by a
// bundler/build step.
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'server/db/migrations');

async function main() {
  // Run pending Drizzle migrations automatically on every startup so the
  // schema is always up-to-date in both development and production.
  if (config.DATABASE_URL) {
    const pool = new Pool({ connectionString: config.DATABASE_URL });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    await pool.end();
    console.log('Database migrations applied.');
  }

  // Log which email delivery path is active so production deployments are easy to verify.
  if (config.SMTP_URL) {
    console.log('Email delivery: SMTP (SMTP_URL)');
  } else if (process.env.REPLIT_CONNECTORS_HOSTNAME) {
    console.log('Email delivery: Resend connector (REPLIT_CONNECTORS_HOSTNAME)');
  } else {
    console.log('Email delivery: none (dev/test only — magic links logged to console)');
  }

  app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`Glitter API listening on http://0.0.0.0:${config.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
