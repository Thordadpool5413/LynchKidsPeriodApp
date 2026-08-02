import { Environment, SignedDataVerifier } from '@apple/app-store-server-library';
import type { EntitlementStatus } from '../../shared/types';
import { config } from '../config';

function verifiers(): SignedDataVerifier[] {
  if (!config.APPLE_ROOT_CA_BASE64) throw new Error('Apple verification is not configured');
  const roots = config.APPLE_ROOT_CA_BASE64.split(',').map((item) => Buffer.from(item.trim(), 'base64'));
  return [
    ...(config.APPLE_APP_ID ? [new SignedDataVerifier(roots, true, Environment.PRODUCTION, config.APPLE_BUNDLE_ID, config.APPLE_APP_ID)] : []),
    new SignedDataVerifier(roots, true, Environment.SANDBOX, config.APPLE_BUNDLE_ID),
  ];
}

export interface VerifiedAppleEntitlement {
  eventId: string;
  parentAccountId?: string;
  status: EntitlementStatus;
  plan?: 'monthly' | 'annual';
  productId?: string;
  originalTransactionId?: string;
  expiresAt?: Date;
}

export async function verifyAppleNotification(signedPayload: string): Promise<VerifiedAppleEntitlement> {
  let lastError: unknown;
  for (const verifier of verifiers()) {
    try {
      const notification = await verifier.verifyAndDecodeNotification(signedPayload);
      const signedTransaction = notification.data?.signedTransactionInfo;
      const transaction = signedTransaction ? await verifier.verifyAndDecodeTransaction(signedTransaction) : undefined;
      const type = String(notification.notificationType ?? '');
      const subtype = String(notification.subtype ?? '');
      let status: EntitlementStatus = transaction?.expiresDate && transaction.expiresDate > Date.now() ? 'active' : 'expired';
      if (transaction?.revocationDate || type === 'REFUND') status = 'refunded';
      else if (type === 'REVOKE') status = 'revoked';
      else if (type === 'DID_FAIL_TO_RENEW') status = subtype === 'GRACE_PERIOD' ? 'grace_period' : 'billing_retry';
      else if (type === 'GRACE_PERIOD_EXPIRED' || type === 'EXPIRED') status = 'expired';
      else if (['SUBSCRIBED', 'DID_RENEW', 'DID_RECOVER', 'RENEWAL_EXTENDED', 'OFFER_REDEEMED'].includes(type)) status = 'active';
      const plan = transaction?.productId === config.APPLE_MONTHLY_PRODUCT_ID ? 'monthly' : transaction?.productId === config.APPLE_ANNUAL_PRODUCT_ID ? 'annual' : undefined;
      return { eventId: notification.notificationUUID ?? `${notification.signedDate ?? Date.now()}`, parentAccountId: transaction?.appAccountToken, status, plan, productId: transaction?.productId, originalTransactionId: transaction?.originalTransactionId, expiresAt: transaction?.expiresDate ? new Date(transaction.expiresDate) : undefined };
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error('Apple notification verification failed');
}
