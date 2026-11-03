// Node-only BIP32 master key derivation for test infrastructure.
// No browser wallet, address generator, or funds support yet.
import {createHmac} from 'node:crypto';
export function masterFromSeed(seed){
 if(!(seed instanceof Uint8Array)||seed.length<16||seed.length>64)throw Error('BIP32 seed must be 16-64 bytes');
 const I=createHmac('sha512',Buffer.from('Bitcoin seed','utf8')).update(seed).digest();
 const secret=I.subarray(0,32),chainCode=I.subarray(32);
 const n=BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
 const k=BigInt('0x'+secret.toString('hex'));
 if(k===0n||k>=n)throw Error('Invalid BIP32 master secret');
 return {secret:Buffer.from(secret),chainCode:Buffer.from(chainCode)};
}
