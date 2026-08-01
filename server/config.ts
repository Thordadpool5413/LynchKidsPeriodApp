import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  FIELD_ENCRYPTION_KEY: z.string().optional(),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:8081'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_MONTHLY_PRICE_ID: z.string().optional(),
  STRIPE_ANNUAL_PRICE_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.2'),
  OPENAI_ZDR_APPROVED: z.enum(['true', 'false']).default('false'),
  ASK_BLOOM_GENERATIVE_ENABLED: z.enum(['true', 'false']).default('false'),
});

export const config = schema.parse(process.env);

if (config.NODE_ENV === 'production') {
  const required = ['DATABASE_URL', 'SESSION_SECRET', 'FIELD_ENCRYPTION_KEY'] as const;
  const missing = required.filter((key) => !config[key]);
  if (missing.length) throw new Error(`Missing production secrets: ${missing.join(', ')}`);
}
