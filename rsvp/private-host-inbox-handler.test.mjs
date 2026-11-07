import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateHostInboxHandler } from './private-host-inbox-handler.mjs';
const host='123e4567-e89b-42d3-a456-426614174000';
const inviteId='123e4567-e89b-42d3-a456-426614174001';
const query={inviteId,limit:10};
function setup(overrides={}) {
 const calls=[];
 const deps={
  authenticate:async()=>{calls.push('auth');return {userId:host};},
  rateLimit:async()=>{calls.push('limit');return true;},
  loadInvite:async()=>{calls.push('load');return {id:inviteId,ownerUserId:host,deletedAt:null};},
  readResponses:async args=>{calls.push('read');assert.deepEqual(args,{hostUserId:host,inviteId,limit:10});return [{receiptId:'receipt',choice:'yes',savedAt:'2026-11-06T23:00:00Z',privateEmail:'never expose'}];},
  ...overrides
 };
 return {handler:createPrivateHostInboxHandler(deps),calls};
}
test('host receives minimal responses, excluding private fields',async()=>{
 const {handler,calls}=setup();
 assert.deepEqual(await handler({method:'GET',query}),{status:200,body:{responses:[{receiptId:'receipt',choice:'yes',savedAt:'2026-11-06T23:00:00Z'}]}});
 assert.deepEqual(calls,['auth','limit','load','read']);
});
test('different host and deleted invitation cannot read',async()=>{
 for(const patch of [{ownerUserId:'123e4567-e89b-42d3-a456-426614174009'},{deletedAt:'2026-11-06T23:00:00Z'}]){
  const {handler,calls}=setup({loadInvite:async()=>{calls.push('load');return {id:inviteId,ownerUserId:host,deletedAt:null,...patch};}});
  assert.equal((await handler({method:'GET',query})).status,403);
  assert.ok(!calls.includes('read'));
 }
});
test('rate limit and invalid pagination fail closed before reading',async()=>{
 const a=setup({rateLimit:async()=>false});
 assert.equal((await a.handler({method:'GET',query})).status,403);
 assert.deepEqual(a.calls,['auth']);
 const b=setup();
 assert.equal((await b.handler({method:'GET',query:{...query,limit:1000}})).status,403);
 assert.deepEqual(b.calls,['auth','limit']);
});
test('invalid database output and dependency errors never leak',async()=>{
 const a=setup({readResponses:async()=>[{receiptId:'r',choice:'invalid',savedAt:'now'}]});
 assert.deepEqual(await a.handler({method:'GET',query}),{status:403,body:{error:'Inbox unavailable'}});
 const b=setup({loadInvite:async()=>{throw Error('database secret');}});
 assert.equal((await b.handler({method:'GET',query})).status,403);
});

test('blank host identity fails closed before rate limit or database access',async()=>{
 for(const userId of ['', ' ', '\t']){
  const {handler,calls}=setup({authenticate:async()=>{calls.push('auth');return {userId};}});
  assert.deepEqual(await handler({method:'GET',query}),{status:403,body:{error:'Inbox unavailable'}});
  assert.deepEqual(calls,['auth']);
 }
});

test('malformed private inbox receipt identifiers and timestamps fail closed',async()=>{
 for(const patch of [
  {receiptId:''},
  {receiptId:'   '},
  {savedAt:'not-a-date'},
  {savedAt:''}
 ]){
  const {handler}=setup({readResponses:async()=>[{receiptId:'receipt',choice:'yes',savedAt:'2026-11-06T23:00:00Z',...patch}]});
  assert.deepEqual(await handler({method:'GET',query}),{status:403,body:{error:'Inbox unavailable'}});
 }
});
