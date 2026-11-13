import type { ApiErrorBody } from '@content-platform/shared';

import { API_URL } from '@/lib/config';
import { getOrCreateDeviceId } from '@/lib/device-id';
import { secureStorage } from '@/lib/secure-storage';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
};

/** Small fetch wrapper: adds the JSON headers, the access token and the device id. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const [token, deviceId] = await Promise.all([
    secureStorage.getAccessToken(),
    getOrCreateDeviceId(),
  ]);

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Request failed',
      error?.details,
    );
  }
  return data as T;
}
