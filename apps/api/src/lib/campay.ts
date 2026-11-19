/**
 * Campay API client (FR30, FR31).
 *
 * Authentication strategy (in order of preference):
 *  1. CAMPAY_PERMANENT_ACCESS_TOKEN — used directly as the Bearer token.
 *     No token exchange needed. This is the recommended approach.
 *  2. CAMPAY_APP_USERNAME + CAMPAY_APP_PASSWORD — exchanged for a short-lived
 *     token via POST /token/. The token is cached until it expires.
 *
 * Base URL:
 *  - CAMPAY_BASE_URL if explicitly set, otherwise:
 *  - https://demo.campay.net  when CAMPAY_MODE=sandbox  (default)
 *  - https://www.campay.net   when CAMPAY_MODE=production
 *
 * SWE applied:
 *  - Single Responsibility: only wraps Campay HTTP; no business logic here.
 *  - Fail Fast: missing credentials are detected before any HTTP call.
 *  - Separation of Concerns: auth strategy is fully isolated in getToken().
 *  - Open/Closed: switching from token-exchange to permanent token requires
 *    only an env-var change, no code change.
 */

import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { badRequest } from './errors';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Base URL resolution
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  if (env.CAMPAY_BASE_URL) {
    const baseUrl = env.CAMPAY_BASE_URL.replace(/\/+$/, '');
    return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
  }
  return env.CAMPAY_MODE === 'production'
    ? 'https://www.campay.net/api'
    : 'https://demo.campay.net/api';
}

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
  status?: 'SUCCESSFUL' | 'FAILED' | 'PENDING';
  ussd_code?: string;
  operator?: string;
}

export interface CampayTransactionStatus {
  reference: string;
  status: 'SUCCESSFUL' | 'FAILED' | 'PENDING';
  amount: string | number;
  currency: string;
  operator: string;
}

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

/** Short-lived token cache (only used when permanent token is not set). */
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Returns the Authorization header value to use on Campay API calls.
 *
 * Prefers the permanent access token because it requires no network call.
 * Falls back to username/password token exchange.
 */
async function getAuthToken(): Promise<string> {
  // Strategy 1: permanent access token (no network call needed).
  if (env.CAMPAY_PERMANENT_ACCESS_TOKEN) {
    return env.CAMPAY_PERMANENT_ACCESS_TOKEN;
  }

  // Strategy 2: short-lived token from username + password.
  if (!env.CAMPAY_APP_USERNAME || !env.CAMPAY_APP_PASSWORD) {
    throw badRequest(
      'Payment provider is not configured: set CAMPAY_PERMANENT_ACCESS_TOKEN ' +
        'or both CAMPAY_APP_USERNAME and CAMPAY_APP_PASSWORD',
    );
  }

  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const res = await fetch(`${getBaseUrl()}/token/`, {
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

  const data = (await res.json()) as { token?: string; expiry?: number; expires_in?: number };
  if (!data.token) throw new Error('Campay auth response did not include a token');
  cachedToken = data.token;
  // The documented response uses expires_in seconds. Use a conservative fallback.
  const lifetimeSeconds = data.expires_in ?? data.expiry ?? 3600;
  tokenExpiresAt = Date.now() + Math.max(0, lifetimeSeconds - 60) * 1000;
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
  const token = await getAuthToken();

  const res = await fetch(`${getBaseUrl()}/collect/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      from: params.phoneNumber.replace(/^\+/, ''),
      description: params.description,
      external_reference: params.externalRef,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, body }, 'Campay collect failed');
    throw new Error(`Campay collect failed: ${res.status}`);
  }

  const data = (await res.json()) as CampayCollectResult;
  if (!data.reference) throw new Error('Campay collect response did not include a reference');
  return data;
}

/**
 * FR31: verify a transaction's status directly with Campay.
 * Never trust the webhook body alone — always call this before processing.
 */
export async function getTransactionStatus(reference: string): Promise<CampayTransactionStatus> {
  const token = await getAuthToken();

  const res = await fetch(`${getBaseUrl()}/transaction/${encodeURIComponent(reference)}/`, {
    headers: { Authorization: `Token ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, body, reference }, 'Campay status check failed');
    throw new Error(`Campay status check failed: ${res.status}`);
  }

  const data = (await res.json()) as CampayTransactionStatus;
  if (!data.reference || !data.status) throw new Error('Campay status response was incomplete');
  return data;
}

/** CamPay posts a JWT in the callback body's `signature` field. */
export function verifyWebhookSignature(signature: string | undefined): boolean {
  if (!env.CAMPAY_WEBHOOK_KEY || !signature) return false;
  try {
    jwt.verify(signature, env.CAMPAY_WEBHOOK_KEY, { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

/** Expose for testing — resets the short-lived token cache. */
export function _resetTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}
