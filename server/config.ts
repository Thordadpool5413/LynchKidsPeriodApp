import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  FIELD_ENCRYPTION_KEY: z.string().optional(),
  PUBLIC_APP_URL: z.string().url().default(
    process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'http://localhost:8081'
  ),
  RESEND_API_KEY: z.string().optional(),
  PARENT_EMAIL_FROM: z.string().min(3).optional(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  VPC_PROVIDER_ENABLED: z.enum(['true', 'false']).default('false'),
  VPC_PROVIDER_SECRET: z.string().min(32).optional(),
  CONSENT_POLICY_VERSION: z.string().default('2026-08-draft'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_MONTHLY_PRICE_ID: z.string().optional(),
  STRIPE_ANNUAL_PRICE_ID: z.string().optional(),
  APPLE_ROOT_CA_BASE64: z.string().optional(),
  APPLE_APP_ID: z.coerce.number().int().positive().optional(),
  APPLE_BUNDLE_ID: z.string().default('com.lynchkids.avacado'),
  APPLE_MONTHLY_PRODUCT_ID: z.string().optional(),
  APPLE_ANNUAL_PRODUCT_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.2'),
  OPENAI_ZDR_APPROVED: z.enum(['true', 'false']).default('false'),
  ASK_BLOOM_GENERATIVE_ENABLED: z.enum(['true', 'false']).default('false'),
  /** nodemailer-compatible transport URL, e.g. smtp://user:pass@host:587  */
  SMTP_URL: z.string().url().optional(),
  /** Reply-to address shown on magic-link emails.
   *  Must be a verified sender in your email provider.
   *  Production: set EMAIL_FROM=noreply@mail.avacado.app (requires mail.avacado.app to be
   *  DNS-verified in the Resend dashboard at resend.com/domains).
   *  Development fallback: onboarding@resend.dev works without domain verification. */
  EMAIL_FROM: z.string().email().default('onboarding@resend.dev'),
});

export const config = schema.parse(process.env);

if (config.NODE_ENV === 'production') {
  const required = ['DATABASE_URL', 'SESSION_SECRET', 'FIELD_ENCRYPTION_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_MONTHLY_PRICE_ID', 'STRIPE_ANNUAL_PRICE_ID'] as const;
  const missing = required.filter((key) => !config[key]);
  if (missing.length) throw new Error(`Missing production secrets: ${missing.join(', ')}`);
  if (!config.RESEND_API_KEY && !config.SMTP_URL && !process.env.REPLIT_CONNECTORS_HOSTNAME) {
    throw new Error('Missing production email delivery: set RESEND_API_KEY, SMTP_URL, or connect the Resend integration.');
  }
}
