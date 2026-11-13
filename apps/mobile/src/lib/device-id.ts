import { randomUUID } from 'expo-crypto';

import { secureStorage } from './secure-storage';

/**
 * Returns the identifier of this device, creating it on first launch.
 * The backend uses it to track the free daily viewing time of visitors
 * (see spec FR16). TODO: register it with POST /devices/register.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await secureStorage.getDeviceId();
  if (existing) return existing;
  const id = randomUUID();
  await secureStorage.setDeviceId(id);
  return id;
}
