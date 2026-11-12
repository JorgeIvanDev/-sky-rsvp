// Server-only wallet challenge protocol for an OPTIONAL Natas identity link.
// Production adapters must persist nonce digests, atomically consume once, and
// verify the wallet-specific signature over the EXACT UTF-8 challenge bytes.
// Never accept a playerId from a browser request or store wallet secrets.
import {randomBytes, createHash, timingSafeEqual} from "node:crypto";
const ADDRESS=/^[a-zA-Z0-9:_-]{8,160}$/;
const DOMAIN=/^[a-zA-Z0-9.-]{1,180}$/;
const digest=x=>createHash("sha256").update(x,"utf8").digest("hex");
export async function issueWalletChallenge({session,address,origin,store,now=Date.now(),ttlMs=180000,enabled=false}) {
  if(!enabled) return {ok:false,error:"feature_disabled"};
  if(!session?.playerId || typeof session.playerId!=="string") return {ok:false,error:"unauthorized"};
  if(typeof address!=="string" || !ADDRESS.test(address) || typeof origin!=="string" || !DOMAIN.test(origin)) return {ok:false,error:"invalid_request"};
  if(!store || typeof store.create!=="function") return {ok:false,error:"unavailable"};
  if(!Number.isFinite(now) || !Number.isSafeInteger(ttlMs) || ttlMs<30000 || ttlMs>300000) return {ok:false,error:"invalid_request"};
  const nonce=randomBytes(32).toString("hex");
  const expiresAt=now+ttlMs;
  const challenge=["CNIDARIA optional wallet link","Domain: "+origin,"Player: "+session.playerId,"Wallet: "+address,"Nonce: "+nonce,"Expires: "+expiresAt].join("\n");
  const nonceHash=digest(nonce);
  try {
    await store.create({nonceHash,playerId:session.playerId,address,origin,challengeHash:digest(challenge),expiresAt});
    return {ok:true,challenge,nonce,expiresAt};
  } catch {return {ok:false,error:"unavailable"};}
}
export async function confirmWalletChallenge({session,nonce,challenge,signature,origin,store,verifySignature,linkWallet,now=Date.now(),enabled=false}) {
  if(!enabled) return {ok:false,error:"feature_disabled"};
  if(!session?.playerId || typeof session.playerId!=="string") return {ok:false,error:"unauthorized"};
  if(typeof nonce!=="string" || !/^[0-9a-f]{64}$/.test(nonce) || typeof challenge!=="string" || challenge.length>1000 || typeof signature!=="string" || !signature || signature.length>2048 || typeof origin!=="string") return {ok:false,error:"invalid_request"};
  if(typeof store?.consume!=="function" || typeof verifySignature!=="function" || typeof linkWallet!=="function") return {ok:false,error:"unavailable"};
  try {
    // consume MUST be a single atomic delete/UPDATE ... RETURNING, not read-then-delete.
    const record=await store.consume(digest(nonce));
    if(!record) return {ok:false,error:"invalid_or_replayed"};
    if(record.playerId!==session.playerId || record.origin!==origin || record.expiresAt<=now) return {ok:false,error:"invalid_or_replayed"};
    const a=Buffer.from(record.challengeHash,"hex"),b=Buffer.from(digest(challenge),"hex");
    if(a.length!==32 || !timingSafeEqual(a,b)) return {ok:false,error:"invalid_or_replayed"};
    const valid=await verifySignature({address:record.address,signature,message:challenge});
    if(valid!==true) return {ok:false,error:"invalid_signature"};
    await linkWallet({playerId:session.playerId,address:record.address});
    return {ok:true,linked:true};
  } catch {return {ok:false,error:"unavailable"};}
}
