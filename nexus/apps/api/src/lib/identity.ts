import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export async function authenticate(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
  if (!match) { res.status(401).json({ error: 'Autenticação necessária.' }); return null; }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) { res.status(503).json({ error: 'Autenticação ainda não configurada.' }); return null; }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  try {
    const { data: { user }, error } = await client.auth.getUser(match[1]);
    if (error || !user || user.is_anonymous) {
      res.status(error?.status && error.status >= 500 ? 503 : 401)
        .json({ error: 'Não foi possível validar sua sessão. Entre novamente.' });
      return null;
    }
    return { client, user };
  } catch {
    res.status(503).json({ error: 'Serviço de autenticação indisponível. Tente novamente.' });
    return null;
  }
}
