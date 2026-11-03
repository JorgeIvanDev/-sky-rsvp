// CNIDARIA RSVP client. Not loaded by the live app until SQL is installed.
// Tokens are bearer capabilities. Never put organizer secrets in invitation links.
export function randomSecret(cryptoApi=globalThis.crypto){
 const bytes=new Uint8Array(32);
 cryptoApi.getRandomValues(bytes);
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
export function createRsvpClient(baseUrl,publishableKey,fetcher=globalThis.fetch){
 if(!/^https:\/\//.test(baseUrl))throw Error('HTTPS required');
 const endpoint=baseUrl.replace(/\/$/,'')+'/rest/v1/rpc/';
 async function call(method,args){
  const response=await fetcher(endpoint+method,{
   method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},
   body:JSON.stringify(args)
  });
  if(!response.ok)throw Error('RSVP service unavailable ('+response.status+')');
  return response.status===204?null:response.json();
 }
 return {
  create:(title,ownerSecret)=>call('cnidaria_create_invite',{p_title:title,p_owner_secret:ownerSecret}),
  reply:(id,replySecret,choice)=>call('cnidaria_reply',{p_invite_id:id,p_reply_secret:replySecret,p_choice:choice}),
  getReplies:(id,ownerSecret)=>call('cnidaria_get_replies',{p_invite_id:id,p_owner_secret:ownerSecret})
 };
}
