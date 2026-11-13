import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const h=fs.readFileSync(new URL('./direct-challenge.html',import.meta.url),'utf8');
test('direct challenge has toss submission RPC and stateful UI',()=>{for(const x of ['cnt_submit_direct_toss','p_airtime_ms','p_caught','play-result','submit-toss','cnt_respond_direct_challenge'])assert.ok(h.includes(x),x)});
test('rendering uses textContent, not untrusted HTML',()=>{assert.ok(!h.includes('innerHTML'));assert.ok(h.includes('textContent'))});
