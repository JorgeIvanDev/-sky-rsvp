import assert from "node:assert/strict";
import {runNatasRead,draftNatasChallenge} from "./natas-read-tools.mjs";
const session={playerId:"player_1"};
let calls=0;
const adapters={
 authorize:async ({groupId})=>groupId!=="outsider",
 personal_best:async ({playerId})=>{calls++;return {playerId,score:4}},
 group_rankings:async ({groupId})=>{calls++;return {groupId,entries:[]}},
 global_rankings:async ()=>{calls++;return []}
};
assert.equal((await runNatasRead({session,tool:"personal_best",adapters})).error,"feature_disabled");
assert.equal((await runNatasRead({tool:"personal_best",adapters,enabled:true})).error,"unauthorized");
assert.equal((await runNatasRead({session,tool:"group_rankings",groupId:"outsider",adapters,enabled:true})).error,"forbidden");
assert.equal((await runNatasRead({session,tool:"group_rankings",adapters,enabled:true})).error,"group_required");
assert.equal((await runNatasRead({session,tool:"global_rankings",groupId:"x",adapters,enabled:true})).error,"unexpected_group");
assert.equal((await runNatasRead({session,tool:"transfer",adapters,enabled:true})).error,"unsupported_tool");
assert.equal(calls,0);
assert.equal((await runNatasRead({session,tool:"personal_best",adapters,enabled:true})).data.playerId,"player_1");
assert.equal((await runNatasRead({session,tool:"group_rankings",groupId:"team",adapters,enabled:true})).ok,true);
assert.equal(calls,2);
assert.equal((await runNatasRead({session,tool:"invitations",adapters,enabled:true})).error,"unavailable");
assert.equal(draftNatasChallenge({opponentId:"friend",message:"Rematch?"}).sent,false);
assert.equal(draftNatasChallenge({opponentId:"friend",message:"Hi\n"}).ok,false);
console.log("Natas permissioned read tools: checks passed");
