import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../../supabase/functions/account-session/index.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function harness() {
  let handler;
  let calls = 0;
  let claimArgs;
  const context = {
    Request, Response, TextEncoder, TextDecoder, Uint8Array, btoa,
    crypto: { randomUUID: () => 'synthetic-id', subtle: { importKey: async () => ({}), sign: async () => new Uint8Array(64) } },
    console: { error() {} },
    Deno: { serve(fn) { handler = fn; }, env: { get: (key) => key === 'SKRIBLY_ENTITLEMENT_PRIVATE_JWK'
      ? JSON.stringify({ kty: 'OKP', crv: 'Ed25519', d: 'synthetic', x: 'synthetic' }) : 'synthetic-test-config' } },
    createClient() {
      calls++;
      return { auth: { getUser: async () => ({ data: { user: { id: 'synthetic-account', email: 'test@example.invalid', email_confirmed_at: 'now', app_metadata: {} } } }) },
        rpc: async (_name, args) => {
          claimArgs = args;
          return { data: [{ trial_ends_at: Math.floor(Date.now() / 1000) + 1000, product_updates_opt_in: true, active_announcements: [] }], error: null };
        } };
    },
  };
  vm.runInNewContext(compiled, context);
  return { handler, calls: () => calls, args: () => claimArgs };
}

const request = (body) => new Request('https://example.invalid/account-session', {
  method: 'POST', headers: { authorization: 'Bearer synthetic-token' }, body,
});

test('malformed, null and non-object JSON are truthful 400 without account calls', async () => {
  for (const body of ['{', 'null', '[]', 'true', '"text"']) {
    const h = harness();
    const result = await h.handler(request(body));
    assert.equal(result.status, 400);
    assert.deepEqual(await result.json(), { error: 'invalid_request' });
    assert.equal(h.calls(), 0);
  }
});

test('request stream is cancelled as soon as its byte cap is exceeded', async () => {
  const h = harness();
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(4097)); }, cancel() { cancelled = true; } });
  const result = await h.handler(new Request('https://example.invalid/account-session', {
    method: 'POST', headers: { authorization: 'Bearer synthetic-token' }, body: stream, duplex: 'half',
  }));
  assert.equal(result.status, 413);
  assert.equal(cancelled, true);
  assert.equal(h.calls(), 0);
});

test('routine refresh preserves consent; explicit boolean is forwarded and persisted choice returned', async () => {
  for (const choice of [undefined, null, false, true]) {
    const h = harness();
    const result = await h.handler(request(JSON.stringify({ deviceClaim: `skd_${'a'.repeat(43)}`, appVersion: '0.1.51-beta.1', productUpdatesOptIn: choice })));
    assert.equal(result.status, 200);
    assert.equal(h.args().p_product_updates_opt_in, choice ?? null);
    assert.equal((await result.json()).productUpdatesOptIn, true);
  }
});
