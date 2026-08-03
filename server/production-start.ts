import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { app } from './app';
import { config } from './config';
import { checkDatabase, db } from './db/client';

async function startProduction(): Promise<void> {
  if (!db) throw new Error('DATABASE_URL is required');

  await migrate(db, { migrationsFolder: './server/db/migrations' });
  if (!await checkDatabase()) throw new Error('Database health check failed after migrations');

  const server = app.listen(config.PORT, '0.0.0.0', async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${config.PORT}/healthz`);
      if (!response.ok) throw new Error(`/healthz returned ${response.status}`);
      console.log(`AvaCado production server ready on port ${config.PORT}`);
    } catch (error) {
      console.error('Production startup verification failed', error);
      server.close(() => process.exit(1));
    }
  });
}

startProduction().catch((error) => {
  console.error('AvaCado production startup failed', error);
  process.exit(1);
});
