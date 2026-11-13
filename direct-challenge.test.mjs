import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const page=fs.readFileSync(new URL('./direct-challenge.html',import.meta.url),'utf8');
test('challenge page includes safe text rendering and RPC contracts',()=>{for(const x of ['cnt_create_direct_challenge','cnt_preview_direct_challenge','cnt_respond_direct_challenge','textContent','p_accept','challenge'])assert.ok(page.includes(x),x);assert.ok(!page.includes('innerHTML'))});
test('challenge OAuth redirect points to its own page',()=>assert.ok(page.includes('redirect_to=https%3A%2F%2Fjorgeivandev.github.io%2F-sky-rsvp%2Fdirect-challenge.html')));
