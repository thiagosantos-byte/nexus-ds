import { Router, type Request, type Response } from 'express';
import { authenticate } from '../lib/identity';

export const platformRouter = Router();

async function administrator(req: Request, res: Response) {
  const identity = await authenticate(req, res);
  if (!identity) return null;
  const { data: demoStatus, error: demoError } = await identity.client.rpc('demo_role_status');
  if (demoError) { res.status(503).json({ error: 'Não foi possível verificar o contexto de acesso.' }); return null; }
  if (demoStatus?.active) { res.status(403).json({ error: 'A administração global fica indisponível durante a demonstração de perfil.' }); return null; }
  const { data, error } = await identity.client.from('platform_administrators')
    .select('user_id').eq('user_id', identity.user.id).is('revoked_at', null).maybeSingle();
  if (error) { res.status(503).json({ error: 'Não foi possível verificar o acesso.' }); return null; }
  if (!data) { res.status(403).json({ error: 'Acesso restrito à administração da plataforma.' }); return null; }
  return identity.client;
}

function databaseError(res: Response, code: string) {
  const status = code === '42501' ? 403 : code === '22023' ? 400 : code === 'P0002' ? 404 : 503;
  const messages: Record<number, string> = {
    403: 'Acesso restrito à administração da plataforma.',
    400: 'Verifique os dados informados.', 404: 'Instituição não encontrada.',
    503: 'Não foi possível concluir a operação. Tente novamente.',
  };
  res.status(status).json({ error: messages[status] });
}

platformRouter.get('/admin/institutions', async (req, res) => {
  const client = await administrator(req, res); if (!client) return;
  const { data, error } = await client.from('institutions').select('id,name,status,created_at').order('created_at', { ascending: false });
  if (error) { databaseError(res, error.code); return; }
  res.json({ institutions: data });
});

platformRouter.post('/admin/institutions', async (req, res) => {
  const client = await administrator(req, res); if (!client) return;
  const body = req.body;
  if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.name !== 'string'
    || !body.name.trim() || Array.from(body.name.trim()).length > 200) {
    res.status(400).json({ error: 'Informe um nome de instituição com até 200 caracteres.' }); return;
  }
  const { data, error } = await client.rpc('platform_create_institution', { p_name: body.name.trim() }).single();
  if (error) { databaseError(res, error.code); return; }
  res.status(201).json({ institution: data });
});

platformRouter.patch('/admin/institutions/:id', async (req, res) => {
  const client = await administrator(req, res); if (!client) return;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.params.id))
    || !req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 1
    || !['active', 'suspended'].includes(req.body.status)) {
    res.status(400).json({ error: 'Informe uma instituição válida e o status desejado.' }); return;
  }
  const { data, error } = await client.rpc('platform_set_institution_status', { p_id: req.params.id, p_status: req.body.status }).single();
  if (error) { databaseError(res, error.code); return; }
  res.json({ institution: data });
});
