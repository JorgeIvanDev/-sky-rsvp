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
 const login={addEventListener:(event,fn)=>{callbacks[event]=fn}};
 const context={URLSearchParams,Date:{now:()=>now},location:{search},document:{getElementById:()=>login},sessionStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}};
 runInNewContext(snippet+';globalThis.result=invite',context);
 return {invite:context.result,click:callbacks.click,values};
}
const token='abcdefghijklmnopqrstuvwxyz123456';
test('direct challenge query is preserved for OAuth return',()=>{
 const x=restore('?challenge='+token);assert.equal(x.invite,token);x.click();assert.equal(JSON.parse(x.values.get('cnidaria-pending-direct-challenge-v1')).token,token);
});
test('OAuth return restores recent pending invite',()=>assert.equal(restore('',{token,at:999000}).invite,token));
test('expired pending invite is rejected',()=>assert.equal(restore('',{token,at:1}).invite,null));
test('malformed invite tokens are rejected',()=>assert.equal(restore('?challenge=%3Cscript%3E').invite,null));
test('no invite is invented without saved or query token',()=>assert.equal(restore('').invite,null));
