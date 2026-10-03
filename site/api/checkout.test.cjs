const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./checkout.js');

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(code, url) { this.statusCode = code; this.location = url; return this; },
  };
}

test('checkout stays explicitly unavailable even if a remote URL is configured', async () => {
  const prior = process.env.SKRIBLY_CHECKOUT_URL;
  process.env.SKRIBLY_CHECKOUT_URL = 'https://example.invalid/checkout';
  try {
    const response = createResponse();
    await handler({ method: 'GET' }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(response.body.code, 'sales_unavailable');
    assert.match(response.body.error, /has not opened sales/i);
    assert.equal(response.location, undefined);
  } finally {
    if (prior === undefined) delete process.env.SKRIBLY_CHECKOUT_URL;
    else process.env.SKRIBLY_CHECKOUT_URL = prior;
  }
});

test('checkout rejects non-GET requests without entering payment handling', async () => {
  const response = createResponse();
  await handler({ method: 'POST' }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, 'GET');
  assert.equal(response.body.error, 'Method not allowed.');
});
