// Regression: malformed stored OAuth sessions must never reach privileged RPCs.
// Uses the production api() function extracted from direct-challenge.html.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../direct-challenge.html',import.meta.url),'utf8');
const start=html.indexOf('async function api(path,body)');
const end=html.indexOf('\nconst rpc=',start);
assert.ok(start>=0&&end>start,'production api function must exist');
const apiSource=html.slice(start,end);
async function scenario(sessionValue,expectedMessage){
 let calls=0,removed=0;
 const session=sessionValue;
 const localStorage={removeItem(){removed++},setItem(){}};
 const fetch=async()=>{calls++;throw Error('Unexpected network call')};
 const invoke=new Function('session','localStorage','fetch','BASE','KEY','STORE',apiSource+';return api;')(session,localStorage,fetch,'https://example.invalid','test','session');
 await assert.rejects(()=>invoke('/rest/v1/rpc/private',{}),new RegExp(expectedMessage));
 assert.equal(calls,0,'invalid sessions must not send requests');
 assert.equal(removed,1,'invalid stored session should be cleared');
}
await scenario({access_token:'token',refresh_token:'refresh'},'Invalid Google session expiry');
await scenario({access_token:'token',refresh_token:'refresh',expires_at:NaN},'Invalid Google session expiry');
await scenario({access_token:'token',refresh_token:'refresh',expires_at:Infinity},'Invalid Google session expiry');
await scenario({access_token:'token',refresh_token:'refresh',expires_at:1.5},'Invalid Google session expiry');
await scenario({access_token:'token',expires_at:1},'Missing Google refresh token');
console.log('Gauntlet OAuth session guards: 5 cases passed');
