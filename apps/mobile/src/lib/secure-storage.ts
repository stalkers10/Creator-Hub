import * as SecureStore from 'expo-secure-store';

const KEYS = {
  accessToken: 'auth.accessToken',
  deviceId: 'device.id',
} as const;

export const secureStorage = {
  getAccessToken: () => SecureStore.getItemAsync(KEYS.accessToken),
  setAccessToken: (token: string) => SecureStore.setItemAsync(KEYS.accessToken, token),
  clearAccessToken: () => SecureStore.deleteItemAsync(KEYS.accessToken),
  getDeviceId: () => SecureStore.getItemAsync(KEYS.deviceId),
  setDeviceId: (id: string) => SecureStore.setItemAsync(KEYS.deviceId, id),
};
