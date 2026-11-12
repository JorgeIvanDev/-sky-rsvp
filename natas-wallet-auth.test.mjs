import assert from "node:assert/strict";
import {issueWalletChallenge,confirmWalletChallenge} from "./natas-wallet-auth.mjs";
const session={playerId:"player_123"},address="wallet_demo_123",origin="example.test";
const records=new Map();
const store={
 async create(record){records.set(record.nonceHash,record)},
 async consume(hash){const r=records.get(hash);records.delete(hash);return r}
};
let linked=0, verified=0;
const verifySignature=async ({address:addr,message,signature})=>{verified++;return addr===address && message.includes("Player: player_123") && signature==="valid_signature"};
const linkWallet=async ({playerId})=>{assert.equal(playerId,session.playerId);linked++};
const issue=args=>issueWalletChallenge({session,address,origin,store,enabled:true,...args});
const confirm=(issued,args={})=>confirmWalletChallenge({session,nonce:issued.nonce,challenge:issued.challenge,signature:"valid_signature",origin,store,verifySignature,linkWallet,enabled:true,...args});
assert.equal((await issueWalletChallenge({session,address,origin,store})).error,"feature_disabled");
assert.equal((await issueWalletChallenge({address,origin,store,enabled:true})).error,"unauthorized");
const first=await issue({now:1000});
assert.equal(first.ok,true);
assert.match(first.challenge,/Nonce: [0-9a-f]{64}/);
assert.equal((await confirm(first,{now:2000})).ok,true);
assert.equal((await confirm(first,{now:2000})).error,"invalid_or_replayed");
assert.equal(linked,1);
const second=await issue({now:1000});
assert.equal((await confirm(second,{session:{playerId:"other"},now:2000})).error,"invalid_or_replayed");
assert.equal((await confirm(second,{now:2000})).error,"invalid_or_replayed");
const third=await issue({now:1000});
assert.equal((await confirm(third,{origin:"evil.test",now:2000})).error,"invalid_or_replayed");
const fourth=await issue({now:1000});
assert.equal((await confirm(fourth,{now:181001})).error,"invalid_or_replayed");
const fifth=await issue({now:1000});
assert.equal((await confirm(fifth,{challenge:fifth.challenge+"x",now:2000})).error,"invalid_or_replayed");
const sixth=await issue({now:1000});
assert.equal((await confirm(sixth,{signature:"bad",now:2000})).error,"invalid_signature");
assert.equal((await confirm(sixth,{now:2000})).error,"invalid_or_replayed");
assert.equal(linked,1);
assert.equal(verified,2);
console.log("Natas wallet nonce, binding, expiry, signature, replay tests passed");
