import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./cnidaria-i18n.js',import.meta.url),'utf8');
function browser({browserLanguage='es-MX',stored=null}={}){
 const values=new Map(stored?[['cnidaria-language',stored]]:[]);
 const listeners=new Map();
 const select={
   id:'',value:'',style:{},innerHTML:'',attributes:{},
   setAttribute(k,v){this.attributes[k]=v},
   addEventListener(k,fn){listeners.set(k,fn)}
 };
 const doc={
   documentElement:{lang:'en'},
   body:{appendChild(el){assert.equal(el,select)}},
   createElement(tag){assert.equal(tag,'select');return select},
   querySelector(){return null},
   getElementById(id){return id==='cnidaria-language'?select:null},
   addEventListener(k,fn){listeners.set('document:'+k,fn)},
   dispatchEvent(){}
 };
 const sandbox={
   document:doc,navigator:{language:browserLanguage,languages:[browserLanguage]},
   localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},
   window:{},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}
 };
 vm.runInNewContext(source,sandbox,{timeout:1000});
 return {doc,select,values,listeners,api:sandbox.window.CnidariaI18n};
}
test('es-LatAm browser locale selects Spanish and retains invitation challenge gate',()=>{
 const b=browser();
 assert.equal(b.api.language,'es');
 assert.equal(b.doc.documentElement.lang,'es');
 assert.match(b.api.t('locked'),/intento/);
 assert.match(b.api.t('locked'),/No tienes que ganar/);
});
test('pt-BR override survives reload and language switch',()=>{
 const b=browser({stored:'pt-BR'});
 assert.equal(b.api.language,'pt');
 assert.match(b.api.t('locked'),/tentativa/);
 b.select.value='en';
 b.listeners.get('change')();
 assert.equal(b.api.language,'en');
 assert.equal(b.values.get('cnidaria-language'),'en');
 assert.equal(b.doc.documentElement.lang,'en');
});
test('unsupported locale falls back to English without requiring storage',()=>{
 const b=browser({browserLanguage:'fr-CA'});
 assert.equal(b.api.language,'en');
 assert.match(b.api.t('locked'),/Complete one phone-toss challenge/);
});
test('all three locales expose safe RSVP choices',()=>{
 const b=browser({browserLanguage:'en-US'});
 for(const language of ['en','es','pt']){
   b.select.value=language;b.listeners.get('change')();
   for(const key of ['yes','maybe','no','create','reveal','share']){
     assert.ok(b.api.t(key).length>3,language+':'+key);
   }
 }
});

test('invitation selectors target static text and never overwrite sender or preview',()=>{
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 assert.match(html,/id="incomingInvite"[\s\S]*?id="incomingFrom"[\s\S]*?id="incomingPreview"[\s\S]*?<p class="sub">The invitation is locked/);
 assert.match(source,/invited:'#incomingInvite > \.eyebrow'/);
 assert.match(source,/locked:'#incomingInvite > p\.sub:nth-of-type\(4\)'/);
 assert.doesNotMatch(source,/locked:'[^']*incomingPreview/);
});
