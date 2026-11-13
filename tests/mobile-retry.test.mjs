import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const match=html.match(/\$\('again'\)\.onclick=(\(\)=>\{[^\n]*?\});\$\('share'\)\.onclick/);
assert.ok(match,'production retry handler must be found');

function retry({sensor=true,nickname=true,state='off',challengeAttempted=false,buttonText='TRY AGAIN · AUTO ARM',incoming=null}={}){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{className:'fail',textContent:'',classList:{remove(v){this.removed=v}}});return elements.get(id)};
 const ctx={sensor,state,challengeAttempted,incoming,$,validNickname:()=>nickname,disarm:()=>{ctx.disarmed=true},activate:()=>{ctx.activated=true},revealInvite:()=>{ctx.revealed=true}}; $('again').textContent=buttonText; $('incomingInvite').scrollIntoView=()=>{ctx.scrolled='incoming'}; $('inviteCreator').scrollIntoView=()=>{ctx.scrolled='creator'}; $('inviteCreatorFold').open=false;
 runInNewContext('const handler='+match[1]+';handler()',ctx);
 return {ctx,$};
}
test('mobile retry with missing motion permission opens permission UI instead of silently failing',()=>{
 const {ctx,$}=retry({sensor:false});
 assert.equal(ctx.activated,undefined);
 assert.equal($('result').className,'hidden');
 assert.equal($('permission').classList.removed,'hidden');
 assert.match($('detail').textContent,/motion permission/i);
});
test('mobile retry without player name gives actionable feedback',()=>{
 const {ctx,$}=retry({nickname:false});
 assert.equal(ctx.activated,undefined);
 assert.equal($('result').className,'hidden');
 assert.match($('detail').textContent,/player name/i);
});
test('authorized mobile retry disarms and reactivates',()=>{
 const {ctx}=retry();
 assert.equal(ctx.disarmed,true);
 assert.equal(ctx.activated,true);
});

test('successful challenge continue opens incoming RSVP without resetting motion',()=>{
 const {ctx,$}=retry({state:'done',challengeAttempted:true,buttonText:'CONTINUE TO RSVP',incoming:{inviteId:'test'}});
 assert.equal(ctx.activated,undefined);
 assert.equal(ctx.disarmed,undefined);
 assert.equal(ctx.revealed,true);
 assert.equal(ctx.scrolled,'incoming');
 assert.equal($('result').className,'hidden');
});
test('successful challenge continue opens invitation creator when no incoming invite',()=>{
 const {ctx,$}=retry({state:'done',challengeAttempted:true,buttonText:'CONTINUE TO RSVP'});
 assert.equal(ctx.activated,undefined);
 assert.equal(ctx.scrolled,'creator');
 assert.equal($('inviteCreatorFold').open,true);
});
