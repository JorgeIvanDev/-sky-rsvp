// Run with: node --test wallet/vault.test.mjs (Node 22+).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {createPhrase,validPhrase,encryptPhrase,decryptPhrase,phraseToSeed} from './vault.mjs';
globalThis.crypto??=webcrypto;
const words=JSON.parse(await readFile(new URL('./english.json',import.meta.url),'utf8'));
const known='abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
test('BIP39 checksum known vector',async()=>{
 assert.equal(await validPhrase(known,words),true);
 assert.equal(await validPhrase(known.replace('about','abandon'),words),false);
});
test('random phrases are distinct and valid',async()=>{
 const a=await createPhrase(words),b=await createPhrase(words);
 assert.equal(await validPhrase(a,words),true);
 assert.notEqual(a,b);
});
test('vault decrypt, wrong password and tamper rejection',async()=>{
 const v=await encryptPhrase(known,'a-long-test-password',words);
 assert.equal(await decryptPhrase(v,'a-long-test-password',words),known);
 await assert.rejects(decryptPhrase(v,'incorrect-password',words));
 await assert.rejects(decryptPhrase({...v,iv:v.iv.slice(0,-4)+'AAAA'},'a-long-test-password',words));
});
test('rejects weak password',async()=>{
 await assert.rejects(encryptPhrase(known,'short',words));
});

test('BIP39 official TREZOR seed test vector',async()=>{
 const seed=await phraseToSeed(known,'TREZOR',words);
 const hex=Buffer.from(seed).toString('hex');
 assert.equal(hex.slice(0,32),'c55257c360c07c72029aebc1b53c05ed');
});
