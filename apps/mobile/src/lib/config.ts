/**
 * Base URL of the backend API.
 * - Android emulator: http://10.0.2.2:4000
 * - Physical device: your computer's LAN IP, or a public tunnel URL
 * Set it in apps/mobile/.env (see .env.example).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
