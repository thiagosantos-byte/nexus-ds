import { Router } from 'express';
import { authenticate } from '../lib/identity';

export const identityRouter = Router();

identityRouter.get('/auth/me', async (req, res) => {
  const identity = await authenticate(req, res);
  if (!identity) return;
  const { client, user } = identity;
  try {
    const [memberships, platform] = await Promise.all([
      client.from('institution_memberships')
        .select('id,status,requested_role,institution_id,institutions(id,name,status),membership_roles(role)')
        .eq('user_id', user.id),
      client.from('platform_administrators').select('user_id').eq('user_id', user.id).is('revoked_at', null),
    ]);
    if (memberships.error || platform.error) {
      res.status(503).json({ error: 'Não foi possível consultar seus vínculos. Tente novamente.' });
      return;
    }
    res.json({ user: { id: user.id, email: user.email }, memberships: memberships.data,
      isPlatformAdministrator: platform.data.length > 0 });
  } catch {
    res.status(503).json({ error: 'Serviço de autenticação indisponível. Tente novamente.' });
  }
});
