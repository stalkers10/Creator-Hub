import { Router } from 'express';

import { optionalAuth, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  getCreatorHandler,
  listCreatorsHandler,
  updateCreatorHandler,
} from './creators.controller';
import {
  creatorIdParamsSchema,
  listCreatorsQuerySchema,
  updateCreatorProfileSchema,
} from './creators.schemas';

export const creatorsRoutes: Router = Router();

creatorsRoutes.get(
  '/',
  optionalAuth,
  validate({ query: listCreatorsQuerySchema }),
  listCreatorsHandler,
); // FR10

creatorsRoutes.put(
  '/me',
  requireAuth,
  validate({ body: updateCreatorProfileSchema }),
  updateCreatorHandler,
); // FR7

creatorsRoutes.get(
  '/:id',
  optionalAuth,
  validate({ params: creatorIdParamsSchema }),
  getCreatorHandler,
); // FR10 + FR12
