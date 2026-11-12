// Trusted-server event-room access boundary. Never import into the browser.
// authenticate() must verify the session cryptographically. The invite ID is
// a locator, never a credential. Resolve member identity only from the session.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(status,code)=>({status,body:{error:code}});
export function createEventRoomAccess({authenticate,findMember,readRoom,readPotluck,readMessages,claimItem,postMessage,rateLimit}){
  for(const [name,fn] of Object.entries({authenticate,findMember,readRoom,readPotluck,readMessages,claimItem,postMessage,rateLimit}))
    if(typeof fn!=='function')throw new TypeError(name+' must be a trusted server function');
  async function authorize(request){
    const inviteId=request?.inviteId;
    if(typeof inviteId!=='string'||!UUID.test(inviteId))return {error:fail(400,'invalid_invite')};
    const principal=await authenticate(request);
    if(!principal||typeof principal.subject!=='string'||principal.subject.length<16)return {error:fail(401,'authentication_required')};
    const member=await findMember({inviteId,subject:principal.subject});
    if(!member||member.revoked_at||!UUID.test(member.member_id||''))
      return {error:fail(403,'room_access_denied')};
    return {inviteId,memberId:member.member_id};
  }
  async function execute(request){
    const auth=await authorize(request);
    if(auth.error)return auth.error;
    const {inviteId,memberId}=auth;
    if(!(await rateLimit({inviteId,memberId,action:request.action})))return fail(429,'rate_limited');
    switch(request.action){
      case 'read': return {status:200,body:{
        room:await readRoom({inviteId,memberId}),
        potluck:await readPotluck({inviteId,memberId}),
        messages:await readMessages({inviteId,memberId,limit:100})
      }};
      case 'claim':
      case 'unclaim':{
        if(typeof request.itemId!=='string'||!UUID.test(request.itemId))return fail(400,'invalid_item');
        const result=await claimItem({inviteId,memberId,itemId:request.itemId,claim:request.action==='claim'});
        return result?.ok?{status:200,body:{claimed:request.action==='claim'}}:fail(409,'assignment_unavailable');
      }
      case 'post':{
        const body=request.body;
        if(typeof body!=='string'||!body.trim()||body.trim().length>2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(body))return fail(400,'invalid_message');
        const id=await postMessage({inviteId,memberId,body:body.trim()});
        return id?{status:201,body:{messageId:id}}:fail(403,'room_access_denied');
      }
      default:return fail(400,'unsupported_action');
    }
  }
  return {execute};
}
