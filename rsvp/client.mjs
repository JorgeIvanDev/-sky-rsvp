// CNIDARIA RSVP client. RPCs intentionally locked until abuse protections pass.
// Organizer secrets are bearer capabilities: never put them in invitation links.
const SECRET=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CHOICES=new Set(['yes','maybe','no']);
export function randomSecret(cryptoApi=globalThis.crypto){
 if(!cryptoApi||typeof cryptoApi.getRandomValues!=='function')throw Error('Secure randomness unavailable');
 const bytes=new Uint8Array(32);
 cryptoApi.getRandomValues(bytes);
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
export function createRsvpClient(baseUrl,publishableKey,fetcher=globalThis.fetch){
 const url=new URL(baseUrl);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('HTTPS required');
 if(typeof publishableKey!=='string'||!publishableKey.trim())throw Error('Publishable key required');
 if(typeof fetcher!=='function')throw Error('Fetch unavailable');
 const endpoint=url.toString().replace(/\/$/,'')+'/rest/v1/rpc/';
 async function call(method,args){
  const response=await fetcher(endpoint+method,{
   method:'POST',redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{apikey:publishableKey,'Content-Type':'application/json'},
   body:JSON.stringify(args)
  });
  if(!response.ok)throw Error('RSVP service unavailable ('+response.status+')');
  return response.status===204?null:response.json();
 }
 function checkSecret(secret){if(typeof secret!=='string'||!SECRET.test(secret))throw Error('Invalid RSVP secret');}
 function checkId(id){if(typeof id!=='string'||!UUID.test(id))throw Error('Invalid invitation ID');}
 return {
  create:(title,ownerSecret)=>{
   if(typeof title!=='string'||!title.trim()||title.length>90)throw Error('Invalid invitation title');
   checkSecret(ownerSecret);
   return call('cnidaria_create_invite',{p_title:title.trim(),p_owner_secret:ownerSecret});
  },
  reply:(id,replySecret,choice)=>{
   checkId(id);checkSecret(replySecret);
   if(!CHOICES.has(choice))throw Error('Invalid RSVP choice');
   return call('cnidaria_reply',{p_invite_id:id,p_reply_secret:replySecret,p_choice:choice});
  },
  getReplies:(id,ownerSecret)=>{
   checkId(id);checkSecret(ownerSecret);
   return call('cnidaria_get_replies',{p_invite_id:id,p_owner_secret:ownerSecret});
  }
 };
}
