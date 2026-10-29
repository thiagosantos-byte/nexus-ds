import assert from "node:assert/strict";

const input = process.argv[2];
assert.ok(
  input,
  "Uso: pnpm check:deployment https://FRONTEND https://API [--api-only]",
);
const origin = new URL(input).origin;
const apiOrigin = new URL(process.argv[3] ?? input).origin;

async function check(
  path: string,
  status: number,
  contentType: RegExp,
  method = "GET",
) {
  const response = await fetch(
    `${path.startsWith("/api") ? apiOrigin : origin}${path}`,
    { method, redirect: "manual" },
  );
  assert.equal(response.status, status, `${method} ${path}: status inesperado`);
  assert.match(response.headers.get("content-type") ?? "", contentType, path);
  console.log(`OK ${method} ${path}: ${status}`);
  return response;
}

const health = await check("/api/healthz?probe=1", 200, /application\/json/);
assert.deepEqual(await health.json(), { status: "ok" });
await check("/api", 404, /application\/json/);
await check("/api/nao-existe/detalhe", 404, /application\/json/);
await check("/api/healthz", 404, /application\/json/, "POST");

if (process.argv.includes("--api-only")) process.exit(0);

const home = await check("/", 200, /text\/html/);
const html = await home.text();
assert.match(html, /<div id="root">/);
for (const path of ["/login", "/projetos", "/projetos/1", "/bancas/1"]) {
  const response = await check(path, 200, /text\/html/);
  assert.equal(await response.text(), html, `${path}: fallback SPA incorreto`);
}
const asset = html.match(/src="([^"\s]+\.js)"/);
assert.ok(asset, "Bundle JavaScript não encontrado no HTML");
await check(new URL(asset[1], origin).pathname, 200, /javascript/);
const missing = await fetch(`${origin}/assets/nao-existe.js`, {
  redirect: "manual",
});
assert.equal(
  missing.status,
  404,
  "Asset inexistente não pode receber o HTML da SPA",
);
console.log("OK asset inexistente: 404");
