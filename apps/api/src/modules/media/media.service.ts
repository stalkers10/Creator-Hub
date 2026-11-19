import { v2 as cloudinary } from 'cloudinary';

import { env } from '../../config/env';
import { badRequest } from '../../lib/errors';

/** Lazy Cloudinary configuration — runs only when the first signature is requested. */
function configureCloudinary() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw badRequest('Media uploads are not configured on this server');
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export interface UploadSignature {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
}

/**
 * FR8 — Generate a signed upload authorisation for the mobile app.
 *
 * SWE applied:
 *  - Single Responsibility: signing logic is isolated here; the controller
 *    only translates to HTTP.
 *  - Fail Fast: missing Cloudinary config is detected before any signing attempt.
 *  - Separation of Concerns: the app uploads directly to Cloudinary; this
 *    service never touches the binary content, only the credential.
 */
export function generateUploadSignature(userId: string): UploadSignature {
  configureCloudinary();

  const folder = `content-platform/users/${userId}`;
  const timestamp = Math.round(Date.now() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    env.CLOUDINARY_API_SECRET!,
  );

  return {
    signature,
    timestamp,
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    apiKey: env.CLOUDINARY_API_KEY!,
    folder,
  };
}
