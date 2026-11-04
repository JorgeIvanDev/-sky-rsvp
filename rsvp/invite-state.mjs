// CNIDARIA invite/RSVP state helpers. No network calls and no wallet dependencies.
// Only share the public invite id and content. Never share ownerSecret.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET=/^[0-9a-f]{64}$/;
const CHOICES=new Set(['yes','maybe','no']);

export function publicInviteRecord(id,title){
 if(typeof id!=='string'||!UUID.test(id))throw Error('Invalid invitation ID');
 if(typeof title!=='string'||title.trim().length<1||title.length>90)throw Error('Invalid invitation title');
 return {id,title:title.trim()};
}

export function privateOrganizerRecord(id,ownerSecret){
 if(typeof id!=='string'||!UUID.test(id)||typeof ownerSecret!=='string'||!SECRET.test(ownerSecret))
  throw Error('Invalid organizer credentials');
 return {id,ownerSecret};
}

export function shareableInviteUrl(baseUrl,invite){
 const {id}=publicInviteRecord(invite.id,invite.title);
 const source=new URL(baseUrl);
 if(source.protocol!=='https:'||source.username||source.password)throw Error('HTTPS required');
 // Allowlist only the legacy public invite payload; never copy unknown query keys,
 // fragments, organizer secrets, auth tokens, or credentials into shared URLs.
 const url=new URL(source.pathname,source.origin);
 const payload=source.searchParams.getAll('data');
 if(payload.length===1)url.searchParams.set('data',payload[0]);
 url.searchParams.set('rsvp',id);
 return url.toString();
}

export function readInviteId(urlString){
 const url=new URL(urlString);
 const ids=url.searchParams.getAll('rsvp');
 if(ids.length!==1||!UUID.test(ids[0]))return null;
 return ids[0];
}

export function validateChoice(choice){
 if(!CHOICES.has(choice))throw Error('Invalid RSVP choice');
 return choice;
}

export function formatRsvpStatus(choice){
 switch(validateChoice(choice)){
  case 'yes':return "You're in!";
  case 'maybe':return 'Maybe — you can update your response later.';
  case 'no':return "Can't make it.";
 }
}
