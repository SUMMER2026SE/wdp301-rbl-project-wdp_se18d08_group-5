import assert from 'node:assert/strict';
import test from 'node:test';

test('compiled debate service loads with native Node.js ESM resolution', async () => {
  const serviceUrl = new URL('../dist/features/debate/debate.service.js', import.meta.url);

  await assert.doesNotReject(() => import(serviceUrl.href));
});
