import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../direct-challenge.html',import.meta.url),'utf8');
const start=html.indexOf("const $=id=>document.getElementById(id);");
const end=html.indexOf("let session=null;",start);
assert.ok(start>=0&&end>start,'OAuth invite restoration must be present');
const snippet=html.slice(start,end);
function restore(search,stored,now=1000000){
 const callbacks={};const values=new Map(stored?[['cnidaria-pending-direct-challenge-v1',JSON.stringify(stored)]]:[]);
 const login={href:'https://hwkxuczipnaqzhbnaurw.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fjorgeivandev.github.io%2F-sky-rsvp%2Fdirect-challenge.html',addEventListener:(event,fn)=>{callbacks[event]=fn}};
 const context={URL,URLSearchParams,Date:{now:()=>now},location:{search,href:'https://jorgeivandev.github.io/-sky-rsvp/direct-challenge.html'+search,hash:''},document:{getElementById:()=>login},sessionStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}};
 runInNewContext(snippet+';globalThis.result=invite',context);
 return {invite:context.result,click:callbacks.click,values,login};
}
const token='abcdefghijklmnopqrstuvwxyz123456';
test('direct challenge query is preserved for OAuth return',()=>{
 const x=restore('?challenge='+token);assert.equal(x.invite,token);x.click();assert.equal(JSON.parse(x.values.get('cnidaria-pending-direct-challenge-v1')).token,token);
});
test('OAuth return restores recent pending invite',()=>assert.equal(restore('',{token,at:999000}).invite,token));
test('expired pending invite is rejected',()=>assert.equal(restore('',{token,at:1}).invite,null));
test('malformed invite tokens are rejected',()=>assert.equal(restore('?challenge=%3Cscript%3E').invite,null));
test('no invite is invented without saved or query token',()=>assert.equal(restore('').invite,null));

test('future-dated pending invite cannot be restored',()=>assert.equal(restore('',{token,at:1000001}).invite,null));
test('pending invite exactly at 15 minute limit expires',()=>assert.equal(restore('',{token,at:1000000-15*60*1000}).invite,null));
test('oversized pending token cannot be restored',()=>assert.equal(restore('',{token:'x'.repeat(257),at:999000}).invite,null));

test('malformed query token does not mask a valid OAuth pending invite',()=>{
 assert.equal(restore('?challenge=%3Cscript%3E',{token,at:999000}).invite,token);
});
test('malformed saved OAuth token is not restored',()=>{
 assert.equal(restore('',{token:'invalid!',at:999000}).invite,null);
});
test('expired pending invite is not revived by malformed query token',()=>{
 assert.equal(restore('?challenge=invalid!',{token,at:1}).invite,null);
});

test('OAuth callback retains invite when sessionStorage is blocked',()=>{
 const x=restore('?challenge='+token);
 x.values.set('cnidaria-pending-direct-challenge-v1','');
 x.click();
 const callback=new URL(new URL(x.login.href).searchParams.get('redirect_to'));
 assert.equal(callback.searchParams.get('challenge'),token);
 assert.equal(callback.pathname,'/-sky-rsvp/direct-challenge.html');
});
test('OAuth callback does not invent challenge when none is supplied',()=>{
 const x=restore('');x.click();
 const callback=new URL(new URL(x.login.href).searchParams.get('redirect_to'));
 assert.equal(callback.searchParams.has('challenge'),false);
});
