// Experimental recovery-phrase module. NOT a BSV wallet; do not deposit funds.
const utf8=new TextEncoder(),decode=new TextDecoder();
const bytesTo64=b=>btoa(String.fromCharCode(...b)),from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function createPhrase(words){
 if(words.length!==2048)throw Error('Invalid BIP39 wordlist');
 const entropy=crypto.getRandomValues(new Uint8Array(16));
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',entropy));
 const bits=[...entropy].map(n=>n.toString(2).padStart(8,'0')).join('')+digest[0].toString(2).padStart(8,'0').slice(0,4);
 return bits.match(/.{11}/g).map(x=>words[parseInt(x,2)]).join(' ');
}
export async function validPhrase(phrase,words){
 const parts=phrase.normalize('NFKD').trim().split(/\s+/);
 if(words.length!==2048||parts.length!==12)return false;
 const indexes=parts.map(w=>words.indexOf(w));
 if(indexes.some(n=>n<0))return false;
 const bits=indexes.map(n=>n.toString(2).padStart(11,'0')).join('');
 const entropy=Uint8Array.from(bits.slice(0,128).match(/.{8}/g),n=>parseInt(n,2));
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',entropy));
 return bits.slice(128)===digest[0].toString(2).padStart(8,'0').slice(0,4);
}
async function derive(password,salt){
 if(password.length<12)throw Error('Use a password with at least 12 characters');
 const material=await crypto.subtle.importKey('raw',utf8.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptPhrase(phrase,password,words){
 if(!await validPhrase(phrase,words))throw Error('Invalid recovery phrase');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await derive(password,salt);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8.encode('CNIDARIA-v1')},key,utf8.encode(phrase.normalize('NFKD')));
 return {version:1,salt:bytesTo64(salt),iv:bytesTo64(iv),data:bytesTo64(new Uint8Array(encrypted))};
}
export async function decryptPhrase(vault,password,words){
 if(vault?.version!==1)throw Error('Unsupported vault');
 const salt=from64(vault.salt),iv=from64(vault.iv),data=from64(vault.data);
 if(salt.length!==16||iv.length!==12||data.length<17)throw Error('Invalid vault');
 const key=await derive(password,salt);
 const phrase=decode.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:utf8.encode('CNIDARIA-v1')},key,data));
 if(!await validPhrase(phrase,words))throw Error('Invalid recovery phrase');
 return phrase;
}

/** BIP-39 seed derivation. Sensitive: never log, transmit, or persist raw seed. */
export async function phraseToSeed(phrase,passphrase='',words){
 if(!words||!await validPhrase(phrase,words))throw Error('Invalid recovery phrase');
 const password=utf8.encode(phrase.normalize('NFKD'));
 const salt=utf8.encode(('mnemonic'+passphrase.normalize('NFKD')));
 const material=await crypto.subtle.importKey('raw',password,'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:2048,hash:'SHA-512'},material,512));
}
