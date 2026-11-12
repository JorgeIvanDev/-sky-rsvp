import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventRoomHttpRouter} from './trusted-event-room-http.mjs';
import {createEventRoomAccess} from './trusted-event-room-access.mjs';
const inviteId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const memberId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const itemId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function setup({authenticated=true,member=true}={}){
  const calls=[];
  const access=createEventRoomAccess({
    authenticate:async ({rawRequest})=>{calls.push('auth');return authenticated&&rawRequest.headers.get('authorization')==='Bearer valid'?{subject:'verified-subject-123456'}:null;},
    findMember:async ({inviteId})=>{calls.push('member');return member?{member_id:memberId,revoked_at:null}:null;},
    rateLimit:async ()=>true,
    readRoom:async ()=>({title:'Turkey Hall'}),
    readPotluck:async ()=>[{itemId}],
    readMessages:async ()=>[],
    claimItem:async ()=>{calls.push('claim');return {ok:true};},
    postMessage:async ()=>{calls.push('post');return itemId;}
  });
  return {route:createEventRoomHttpRouter(access),calls};
}
function request(payload,options={}){
 return new Request('https://example.test/api/event-room',{
  method:'POST',headers:{'content-type':'application/json',authorization:'Bearer valid',...(options.headers||{})},
  body:options.body??JSON.stringify(payload)
 });
}
test('trusted room read, claim, unclaim and post are routed with verified session',async()=>{
 const {route,calls}=setup();
 for(const [action,extra,status] of [['read',{},200],['claim',{itemId},200],['unclaim',{itemId},200],['post',{body:'hello'},201]]){
  const result=await route(request({inviteId,action,...extra}));
  assert.equal(result.status,status,action);
  assert.equal(result.headers.get('cache-control'),'no-store');
 }
 assert.deepEqual(calls.filter(x=>x==='claim'),['claim','claim']);
 assert.equal(calls.filter(x=>x==='post').length,1);
});
test('no credential or cross-room authorization means no room read or write',async()=>{
 for(const options of [{authenticated:false},{member:false}]){
  const {route,calls}=setup(options);
  assert.ok([401,403].includes((await route(request({inviteId,action:'read'}))).status));
  assert.ok(!calls.includes('claim'));
 }
});
test('reject cross-site, navigation, query credentials, spoofed member and unsupported methods',async()=>{
 const {route,calls}=setup();
 for(const headers of [
  {origin:'https://evil.test'},{'sec-fetch-site':'cross-site'},
  {'sec-fetch-mode':'navigate'},{'content-type':'text/plain'},
  {'content-encoding':'gzip'},{'transfer-encoding':'chunked'},
  {'content-length':'9999'}
 ]){
  assert.equal((await route(request({inviteId,action:'read'},{headers}))).status,403);
 }
 assert.equal((await route(new Request('https://example.test/api/event-room?token=leak',{method:'POST',body:'{}'}))).status,403);
 assert.equal((await route(new Request('https://example.test/api/event-room'))).status,403);
 assert.equal((await route(request({inviteId,action:'claim',itemId,memberId:'attacker'}))).status,403);
 assert.equal(calls.length,0,'invalid HTTP requests never invoke authorization');
});
test('reject oversized, invalid JSON, arrays, unsupported actions before authentication',async()=>{
 const {route,calls}=setup();
 for(const body of ['{bad','[]',JSON.stringify({inviteId,action:'read',body:'x'.repeat(5000)}),JSON.stringify({inviteId,action:'delete'})]){
  assert.equal((await route(request(null,{body}))).status,403);
 }
 assert.equal(calls.length,0);
});
test('untrusted adapter failure returns no private detail',async()=>{
 const route=createEventRoomHttpRouter({execute:async()=>{throw Error('secret database details')}});
 const result=await route(request({inviteId,action:'read'}));
 assert.equal(result.status,403);
 assert.equal((await result.text()).includes('secret'),false);
});
