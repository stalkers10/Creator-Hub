/**
 * Campay API client (FR30, FR31).
 *
 * Campay uses OAuth2 client-credentials to issue a short-lived token,
 * then that token authorises collection and status calls.
 *
 * SWE applied:
 *  - Single Responsibility: only wraps Campay HTTP; no business logic here.
 *  - Fail Fast: missing credentials are detected before any HTTP call.
 *  - Separation of Concerns: token caching is isolated so callers never
 *    worry about re-authentication.
 */

import { env } from '../config/env';
import { badRequest } from './errors';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CampayCollectParams {
  amount: number;
  currency: 'XAF';
  operator: 'mtn' | 'orange';
  phoneNumber: string;
  externalRef: string; // our internal payment id — used to match the webhook
  description: string;
}

export interface CampayCollectResult {
  reference: string; // Campay's transaction reference (providerReference)
  status: 'SUCCESSFUL' | 'FAILED' | 'PENDING';
  ussd_code?: string;
}

export interface CampayTransactionStatus {
  reference: string;
  status: 'SUCCESSFUL' | 'FAILED' | 'PENDING';
  amount: string;
  currency: string;
  operator: string;
}

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function requireConfig() {
  if (!env.CAMPAY_BASE_URL || !env.CAMPAY_APP_USERNAME || !env.CAMPAY_APP_PASSWORD) {
    throw badRequest('Payment provider is not configured on this server');
  }
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  requireConfig();

  const res = await fetch(`${env.CAMPAY_BASE_URL}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: env.CAMPAY_APP_USERNAME,
      password: env.CAMPAY_APP_PASSWORD,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, body }, 'Campay token request failed');
    throw new Error(`Campay auth failed: ${res.status}`);
  }

  const data = (await res.json()) as { token: string; expiry?: number };
  cachedToken = data.token;
  // Default expiry: 50 minutes (tokens typically valid for 60 min)
  tokenExpiresAt = Date.now() + (data.expiry ?? 50 * 60) * 1000;
  return cachedToken;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * FR30: initiate a mobile money collection.
 * Returns Campay's transaction reference.
 */
export async function initiateCollection(
  params: CampayCollectParams,
): Promise<CampayCollectResult> {
  requireConfig();
  const token = await getToken();

  const res = await fetch(`${env.CAMPAY_BASE_URL}/collect/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify({
      amount: String(params.amount),
      currency: params.currency,
      from: params.phoneNumber,
      description: params.description,
      external_reference: params.externalRef,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, body }, 'Campay collect failed');
    throw new Error(`Campay collect failed: ${res.status}`);
  }

  return res.json() as Promise<CampayCollectResult>;
}

/**
 * FR31: verify a transaction's status directly with Campay.
 * Never trust the webhook body alone — always call this before processing.
 */
export async function getTransactionStatus(reference: string): Promise<CampayTransactionStatus> {
  requireConfig();
  const token = await getToken();

  const res = await fetch(`${env.CAMPAY_BASE_URL}/transaction/${reference}/`, {
    headers: { Authorization: `Token ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, body, reference }, 'Campay status check failed');
    throw new Error(`Campay status check failed: ${res.status}`);
  }

  return res.json() as Promise<CampayTransactionStatus>;
}

/** Expose for testing — resets the token cache. */
export function _resetTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}
