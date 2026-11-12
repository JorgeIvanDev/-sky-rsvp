import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostInboxController } from './host-inbox-controller.mjs';

const inviteId = '123e4567-e89b-42d3-a456-426614174000';
const response = rows => ({
  ok: true, status: 200, redirected: false, type: 'basic',
  headers: { get: () => 'application/json' },
  json: async () => ({ responses: rows })
});

test('clearing pending inbox permits fresh load and stale result cannot overwrite it', async () => {
  let resolveFirst;
  let calls = 0;
  const root = {
    ownerDocument: {
      createElement: () => ({ textContent: '', setAttribute() {}, append() {} }),
      createTextNode: text => text
    },
    replaceChildren() { this.items = []; },
    append(item) { this.items.push(item); }
  };
  const status = { textContent: '' };
  const controller = createHostInboxController({
    root, status, getAccessToken: async () => 'test-token',
    fetcher: async () => {
      calls++;
      return calls === 1
        ? new Promise(resolve => { resolveFirst = resolve; })
        : response([{ receiptId: 'receipt2', choice: 'yes', savedAt: '2026-11-10T16:00:00Z' }]);
    }
  });
  const oldLoad = controller.refresh(inviteId);
  await Promise.resolve();
  await Promise.resolve();
  controller.clear();
  assert.equal(await controller.refresh(inviteId), true);
  assert.equal(status.textContent, 'Showing 1 recent responses.');
  resolveFirst(response([]));
  assert.equal(await oldLoad, false);
  assert.equal(status.textContent, 'Showing 1 recent responses.');
  assert.equal(calls, 2);
});
