import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const h=fs.readFileSync(new URL('./direct-challenge.html',import.meta.url),'utf8');
test('direct challenge has toss submission RPC and stateful UI',()=>{for(const x of ['cnt_submit_direct_toss','p_airtime_ms','p_caught','play-result','submit-toss','cnt_respond_direct_challenge'])assert.ok(h.includes(x),x)});
test('rendering uses textContent, not untrusted HTML',()=>{assert.ok(!h.includes('innerHTML'));assert.ok(h.includes('textContent'))});

test('incoming token preview is not hidden by unrelated accepted or completed challenges',()=>{
  const preview=h.match(/async function preview\(\)\{([\s\S]*?)\nasync function respond/);
  assert.ok(preview,'preview handler exists');
  assert.ok(preview[1].includes("cnt_preview_direct_challenge"));
  assert.ok(!preview[1].includes("current.some"),'other games must not suppress incoming invitation');
  assert.ok(!preview[1].includes("status==='accepted'"),'existing accepted games are unrelated');
});

test('pending OAuth invitation recovery rejects future timestamps and expires within 15 minutes',()=>{
  assert.ok(h.includes('Number.isFinite(saved.at)'));
  assert.ok(h.includes('saved.at<=Date.now()'));
  assert.ok(h.includes('Date.now()-saved.at<15*60*1000'));
});

test('toss submit is single-flight and ambiguous failures require refresh',()=>{assert.match(h,/if\(submitBusy\)return/);assert.match(h,/submitBusy=true/);assert.match(h,/submitBusy=false/);assert.match(h,/Submission status unknown\. Refresh challenges/);assert.doesNotMatch(h,/if\(!confirmed&&\$\('submit-toss'\)\.dataset\.challenge===id\)\$\('submit-toss'\)\.disabled=false/)});

test('motion sample count includes only accepted trace samples',()=>{assert.match(h,/if\(!motionTrace\.add\(\{timestamp:e\.timeStamp,magnitude\}\)\)return;motionSamples\+\+/);assert.doesNotMatch(h,/motionSamples\+\+;motionPeak=.*?motionTrace\.add/s)});
