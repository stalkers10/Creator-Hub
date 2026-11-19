import type { RequestHandler } from 'express';

import { unauthorized } from '../../lib/errors';
import { generateUploadSignature } from './media.service';

/** FR8: return a signed upload authorisation for Cloudinary. */
export const getSignature: RequestHandler = (req, res) => {
  if (!req.user) throw unauthorized();
  const signature = generateUploadSignature(req.user.id);
  res.json(signature);
};
