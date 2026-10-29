import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import app from '../../apps/api/dist/app.mjs';

const server = createServer(app);
let origin;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('Vercel entry serves health check with query parameters', async () => {
  const response = await fetch(`${origin}/api/healthz?probe=1`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

for (const [method, path] of [
  ['GET', '/api'],
  ['GET', '/api/nao-existe'],
  ['GET', '/api/nao-existe/detalhe'],
  ['POST', '/api/healthz'],
]) {
  test(`${method} ${path} returns a JSON 404`, async () => {
    const response = await fetch(`${origin}${path}`, { method });
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    assert.deepEqual(await response.json(), { error: 'Endpoint não encontrado' });
  });
}

for (const authorization of [undefined, 'Basic invalid', 'Bearer bad token']) {
  test(`identity rejects missing or malformed authorization: ${authorization ?? 'missing'}`, async () => {
    const response = await fetch(`${origin}/api/auth/me`, {
      headers: authorization ? { Authorization: authorization } : {},
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal('memberships' in await response.json(), false);
  });
}
