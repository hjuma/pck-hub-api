import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import app from './index';

// Helper to spin up the Express app on a random ephemeral port for native fetch testing
function startTestServer(): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as any;
      const url = `http://127.0.0.1:${address.port}`;
      resolve({ server, url });
    });
  });
}

const AUTH_HEADER = { 'Authorization': 'Bearer pck_test_token_2026' };

test('PC-Kenya Knowledge Hub API Server Test Suite', async (t) => {
  const { server, url } = await startTestServer();

  // Clean up server after tests complete
  t.after(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  await t.test('GET / should return online status without authentication', async () => {
    const res = await fetch(`${url}/`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.status, 'online');
    assert.strictEqual(body.name, 'PC-Kenya Knowledge Hub API Server');
  });

  await t.test('GET /v1/publications should block requests without authorization', async () => {
    const res = await fetch(`${url}/v1/publications`);
    assert.strictEqual(res.status, 401);
    const body = await res.json() as any;
    assert.strictEqual(body.code, 'UNAUTHORIZED');
    assert.ok(body.correlationId);
  });

  await t.test('GET /v1/publications should block requests with invalid tokens', async () => {
    const res = await fetch(`${url}/v1/publications`, {
      headers: { 'Authorization': 'Bearer invalid_token' }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json() as any;
    assert.strictEqual(body.code, 'FORBIDDEN');
  });

  await t.test('GET /v1/taxonomies should return controlled taxonomies with valid token', async () => {
    const res = await fetch(`${url}/v1/taxonomies`, { headers: AUTH_HEADER });
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(Array.isArray(body.resourceTypes));
    assert.ok(Array.isArray(body.subjects));
    assert.ok(Array.isArray(body.geographies));
    assert.ok(Array.isArray(body.languages));
    
    // Validate sample values
    assert.deepStrictEqual(body.resourceTypes[0], { code: 'policy-brief', label: 'Policy Brief' });
  });

  await t.test('GET /v1/publications should return all records deterministically ordered without filters', async () => {
    const res = await fetch(`${url}/v1/publications`, { headers: AUTH_HEADER });
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    
    assert.strictEqual(body.items.length, 5);
    assert.strictEqual(body.nextCursor, null); // since limit default is 100
    assert.strictEqual(body.syncWatermark, '2026-09-05T09:00:00Z'); // updatedAt of last record (pub-2026-005)

    // Verify ordering by updatedAt ASC
    const times = body.items.map((item: any) => item.updatedAt);
    const sortedTimes = [...times].sort();
    assert.deepStrictEqual(times, sortedTimes);
  });

  await t.test('GET /v1/publications with limit should paginate correctly', async () => {
    // Page 1: limit = 2
    const res1 = await fetch(`${url}/v1/publications?limit=2`, { headers: AUTH_HEADER });
    assert.strictEqual(res1.status, 200);
    const body1 = await res1.json() as any;
    
    assert.strictEqual(body1.items.length, 2);
    assert.strictEqual(body1.items[0].id, 'pub-2026-001');
    assert.strictEqual(body1.items[1].id, 'pub-2026-002');
    assert.ok(body1.nextCursor !== null);
    assert.strictEqual(body1.syncWatermark, '2026-09-02T11:30:00Z'); // updatedAt of pub-2026-002

    // Page 2: Fetch using nextCursor from page 1
    const res2 = await fetch(`${url}/v1/publications?limit=2&cursor=${body1.nextCursor}`, { headers: AUTH_HEADER });
    assert.strictEqual(res2.status, 200);
    const body2 = await res2.json() as any;

    assert.strictEqual(body2.items.length, 2);
    assert.strictEqual(body2.items[0].id, 'pub-2026-003');
    assert.strictEqual(body2.items[1].id, 'pub-2026-004');
    assert.ok(body2.nextCursor !== null);
    assert.strictEqual(body2.syncWatermark, '2026-09-04T14:15:00Z'); // updatedAt of pub-2026-004

    // Page 3: Fetch using nextCursor from page 2
    const res3 = await fetch(`${url}/v1/publications?limit=2&cursor=${body2.nextCursor}`, { headers: AUTH_HEADER });
    assert.strictEqual(res3.status, 200);
    const body3 = await res3.json() as any;

    assert.strictEqual(body3.items.length, 1);
    assert.strictEqual(body3.items[0].id, 'pub-2026-005');
    assert.strictEqual(body3.nextCursor, null); // Last page
    assert.strictEqual(body3.syncWatermark, '2026-09-05T09:00:00Z'); // updatedAt of pub-2026-005
  });

  await t.test('GET /v1/publications?updatedSince should filter records after the timestamp', async () => {
    // Querying since Sep 3rd 00:00:00 should return pub-003, pub-004, pub-005
    const res = await fetch(`${url}/v1/publications?updatedSince=2026-09-03T00:00:00Z`, { headers: AUTH_HEADER });
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;

    assert.strictEqual(body.items.length, 3);
    assert.strictEqual(body.items[0].id, 'pub-2026-003');
    assert.strictEqual(body.items[1].id, 'pub-2026-004');
    assert.strictEqual(body.items[2].id, 'pub-2026-005');
  });

  await t.test('GET /v1/publications/{id} should return single record by ID', async () => {
    const res = await fetch(`${url}/v1/publications/pub-2026-001`, { headers: AUTH_HEADER });
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.id, 'pub-2026-001');
    assert.strictEqual(body.title, 'Adolescent Health and Wellbeing in Urban Kenya: A Baseline Study');
  });

  await t.test('GET /v1/publications/{id} should return 404 for nonexistent record', async () => {
    const res = await fetch(`${url}/v1/publications/pub-non-existent`, { headers: AUTH_HEADER });
    assert.strictEqual(res.status, 404);
    const body = await res.json() as any;
    assert.strictEqual(body.code, 'NOT_FOUND');
    assert.ok(body.correlationId);
  });
});
