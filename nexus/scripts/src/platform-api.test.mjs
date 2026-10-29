import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import app from '../../apps/api/dist/app.mjs';

const userId = '10000000-0000-0000-0000-000000000011';
const institution = { id: '20000000-0000-0000-0000-000000000011', name: 'Teste', status: 'active' };
const rpcCalls = [];
const upstream = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url.startsWith('/auth/v1/user')) {
    res.end(JSON.stringify({ id: userId, is_anonymous: false }));
  } else if (req.url.startsWith('/rest/v1/platform_administrators')) {
    res.end(JSON.stringify(req.headers.authorization === 'Bearer admin' ? { user_id: userId } : null));
  } else if (req.url.startsWith('/rest/v1/rpc/demo_role_status')) {
    res.end(JSON.stringify({ active: false }));
  } else if (req.url.startsWith('/rest/v1/rpc/')) {
    rpcCalls.push(req.url);
    res.end(JSON.stringify(institution));
  } else res.end(JSON.stringify([institution]));
});
const server = createServer(app);
let origin;
const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY };
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}
before(async () => {
  process.env.SUPABASE_URL = await listen(upstream);
  process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-test';
  origin = await listen(server);
});
after(async () => {
  for (const s of [server, upstream]) { s.closeAllConnections(); await new Promise(resolve => s.close(resolve)); }
  if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
  if (previous.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = previous.key;
});
async function call(method, suffix = '', body, token = 'admin') {
  return fetch(`${origin}/api/admin/institutions${suffix}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
test('authenticated non-administrator cannot list, create or change institutions', async () => {
  for (const method of ['GET', 'POST', 'PATCH']) {
    const response = await call(method, method === 'PATCH' ? `/${institution.id}` : '', method === 'GET' ? undefined : { name: 'X' }, 'ordinary');
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(rpcCalls.length, 0);
});
test('administrator without institutional membership can list and create', async () => {
  assert.equal((await call('GET')).status, 200);
  const response = await call('POST', '', { name: 'Teste' });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).institution.id, institution.id);
});
test('validation prevents invalid IDs, names, statuses and extra privileged fields', async () => {
  const before = rpcCalls.length;
  for (const [method, suffix, body] of [
    ['POST', '', { name: ' ' }], ['POST', '', { name: 'Teste', status: 'active' }],
    ['POST', '', { name: 'x'.repeat(201) }], ['PATCH', '/invalid', { status: 'active' }],
    ['PATCH', `/${institution.id}`, { status: 'deleted' }],
    ['PATCH', `/${institution.id}`, { status: 'active', user_id: userId }],
  ]) assert.equal((await call(method, suffix, body)).status, 400);
  assert.equal(rpcCalls.length, before);
});
