import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventRoomAccess} from './trusted-event-room-access.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',M='cccccccc-cccc-4ccc-8ccc-cccccccccccc',I='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
function setup({revoked=false,authenticated=true,memberRoom=A,limited=false}={}){
 const calls=[];
 const api=createEventRoomAccess({
  authenticate:async()=>authenticated?{subject:'signed-session-subject-123'}:null,
  findMember:async x=>{calls.push(['member',x]);return x.inviteId===memberRoom?{member_id:M,revoked_at:revoked?'now':null}:null},
  rateLimit:async x=>{calls.push(['limit',x]);return !limited},
  readRoom:async x=>{calls.push(['room',x]);return {title:'Turkey Hall'}},
  readPotluck:async x=>{calls.push(['potluck',x]);return []},
  readMessages:async x=>{calls.push(['messages',x]);return []},
  claimItem:async x=>{calls.push(['claim',x]);return {ok:true}},
  postMessage:async x=>{calls.push(['post',x]);return I}
 });
 return {api,calls};
}
test('invite id alone never authorizes access',async()=>{
 const {api,calls}=setup({authenticated:false});
 assert.equal((await api.execute({inviteId:A,action:'read'})).status,401);
 assert.equal(calls.length,0);
});
test('cross-invite membership and revoked sessions cannot read or write',async()=>{
 for(const cfg of [{memberRoom:B},{revoked:true}]){
  const {api,calls}=setup(cfg);
  for(const action of ['read','claim','post']){
   assert.equal((await api.execute({inviteId:A,action,itemId:I,body:'Hello'})).status,403);
  }
  assert.equal(calls.filter(x=>x[0]!=='member').length,0);
 }
});
test('never trust client supplied member identity for claims or chat',async()=>{
 const {api,calls}=setup();
 assert.equal((await api.execute({inviteId:A,action:'claim',itemId:I,memberId:B})).status,200);
 assert.equal((await api.execute({inviteId:A,action:'post',body:' Hi ',memberId:B})).status,201);
 for(const [,x] of calls.filter(x=>['claim','post'].includes(x[0]))){
  assert.equal(x.memberId,M);
  assert.equal(x.inviteId,A);
 }
 assert.equal(calls.find(x=>x[0]==='post')[1].body,'Hi');
});
test('read is isolated and bounded, no cross-room data fetched',async()=>{
 const {api,calls}=setup();
 assert.equal((await api.execute({inviteId:A,action:'read'})).status,200);
 assert.equal(calls.find(x=>x[0]==='messages')[1].limit,100);
 assert.ok(calls.filter(x=>['room','potluck','messages'].includes(x[0])).every(x=>x[1].inviteId===A));
});
test('invalid payloads and throttling fail before mutations',async()=>{
 const {api,calls}=setup();
 assert.equal((await api.execute({inviteId:'bad',action:'read'})).status,400);
 assert.equal((await api.execute({inviteId:A,action:'claim',itemId:'bad'})).status,400);
 assert.equal((await api.execute({inviteId:A,action:'post',body:' '.repeat(4)})).status,400);
 assert.equal((await api.execute({inviteId:A,action:'post',body:'a'.repeat(2001)})).status,400);
 assert.equal(calls.filter(x=>['claim','post'].includes(x[0])).length,0);
 const denied=setup({limited:true});
 assert.equal((await denied.api.execute({inviteId:A,action:'post',body:'hi'})).status,429);
 assert.equal(denied.calls.filter(x=>x[0]==='post').length,0);
});

test('chat rejects invisible control and bidi spoofing without blocking ordinary multiline messages',async()=>{
 const {api,calls}=setup();
 for(const body of ['hello\u0000world','hello\u001bworld','hello\u202eworld','hello\u2066world']){
  assert.equal((await api.execute({inviteId:A,action:'post',body})).status,400);
 }
 assert.equal(calls.filter(x=>x[0]==='post').length,0);
 assert.equal((await api.execute({inviteId:A,action:'post',body:'Hello\nworld'})).status,201);
 assert.equal(calls.filter(x=>x[0]==='post').length,1);
});
