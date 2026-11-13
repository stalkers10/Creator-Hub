import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { requireAuth } from '../../middleware/auth';

export const paymentsRoutes: Router = Router();

paymentsRoutes.post('/', requireAuth, todo('FR30 start a Campay mobile money collection'));
// No user token here: the call comes from Campay. Never trust the body, verify it with Campay (FR31).
paymentsRoutes.post('/webhook/campay', todo('FR31 FR34 Campay webhook'));
paymentsRoutes.get('/me', requireAuth, todo('FR33 payment history'));
