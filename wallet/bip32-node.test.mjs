import {test} from 'node:test';
import assert from 'node:assert/strict';
import {masterFromSeed} from './bip32-node.mjs';
test('BIP32 vector 1 master secret and chain code',()=>{
 const master=masterFromSeed(Buffer.from('000102030405060708090a0b0c0d0e0f','hex'));
 assert.equal(master.secret.toString('hex'),'e8f32e723decf4051aefac8e2c93c9c5b3f7c8e6bfb5b5e2d4fbc6e6c5fbd4b9');
 assert.equal(master.chainCode.toString('hex'),'873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508');
});
test('rejects invalid seed length',()=>assert.throws(()=>masterFromSeed(new Uint8Array(4))));
