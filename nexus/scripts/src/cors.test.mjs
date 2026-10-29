import { createServer } from "node:http";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import app from "../../apps/api/dist/app.mjs";
let origin;
const server = createServer(app);
before(async () => {
  process.env.FRONTEND_ORIGINS =
    "https://catapimba-mu.vercel.app,https://approved-preview.vercel.app";
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});
test("approved frontend can preflight Authorization without cookies", async () => {
  const r = await fetch(origin + "/api/workspace/catalog", {
    method: "OPTIONS",
    headers: {
      Origin: "https://catapimba-mu.vercel.app",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  assert.equal(r.status, 204);
  assert.equal(
    r.headers.get("access-control-allow-origin"),
    "https://catapimba-mu.vercel.app",
  );
  assert.match(r.headers.get("access-control-allow-headers"), /Authorization/);
  assert.equal(r.headers.get("access-control-allow-credentials"), null);
});
test("unapproved origins and lookalike subdomains are refused", async () => {
  for (const site of [
    "https://unknown.vercel.app",
    "https://catapimba-mu.vercel.app.attacker.test",
    "null",
  ]) {
    const r = await fetch(origin + "/api/healthz", {
      headers: { Origin: site },
    });
    assert.equal(r.status, 403);
    assert.equal(r.headers.get("access-control-allow-origin"), null);
  }
});
test("approved origin still needs authentication", async () => {
  const r = await fetch(origin + "/api/workspace/catalog", {
    headers: { Origin: "https://approved-preview.vercel.app" },
  });
  assert.equal(r.status, 401);
  assert.equal(
    r.headers.get("access-control-allow-origin"),
    "https://approved-preview.vercel.app",
  );
  assert.equal(r.headers.get("cache-control"), "no-store");
});
test("health probes without an Origin remain usable", async () => {
  const r = await fetch(origin + "/api/healthz");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: "ok" });
});
