// Trusted server-only HTTP bridge for invitation-scoped rooms.
// Mount only behind verified authentication, rate limiting and private DB adapters.
// Never accept a member ID from a browser as authorization.
const headers = {'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const deny = () => new Response(JSON.stringify({error:'Unavailable'}),{status:403,headers});
export function createEventRoomHttpRouter(access) {
  if (!access || typeof access.execute !== 'function') throw new TypeError('Trusted event room access required');
  return async function route(request) {
    try {
      if (!(request instanceof Request) || request.method !== 'POST') return deny();
      const url = new URL(request.url);
      if (url.pathname !== '/api/event-room' || url.search || url.hash || url.username || url.password) return deny();
      const origin = request.headers.get('origin');
      if (origin !== null && origin !== url.origin) return deny();
      const site = request.headers.get('sec-fetch-site');
      if (site !== null && !['same-origin','none'].includes(site)) return deny();
      const mode = request.headers.get('sec-fetch-mode');
      if (mode !== null && !['cors','same-origin'].includes(mode)) return deny();
      if (request.headers.has('transfer-encoding')) return deny();
      const encoding = request.headers.get('content-encoding');
      if (encoding !== null && encoding.toLowerCase().trim() !== 'identity') return deny();
      if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(request.headers.get('content-type')||'')) return deny();
      const declared = request.headers.get('content-length');
      if (declared !== null && (!/^\d+$/.test(declared) || Number(declared)>4096)) return deny();
      if (!request.body) return deny();
      const reader=request.body.getReader(), chunks=[];
      let length=0;
      try {
        while (true) {
          const {done,value}=await reader.read();
          if (done) break;
          length+=value.byteLength;
          if (length>4096) { await reader.cancel(); return deny(); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      if (declared !== null && Number(declared)!==length) return deny();
      const bytes=new Uint8Array(length);
      let pos=0;
      for (const chunk of chunks) {bytes.set(chunk,pos);pos+=chunk.length;}
      const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      if (!payload || typeof payload!=='object' || Array.isArray(payload)) return deny();
      if (Object.keys(payload).some(k=>!['inviteId','action','itemId','body'].includes(k))) return deny();
      if (!['read','claim','unclaim','post'].includes(payload.action)) return deny();
      // Each action has an exact payload shape: prevent confused-deputy
      // behavior if adapters later start consuming additional fields.
      const expected = payload.action === 'read' ? ['action','inviteId']
        : payload.action === 'post' ? ['action','body','inviteId']
        : ['action','inviteId','itemId'];
      const actual = Object.keys(payload).sort();
      if (actual.length !== expected.length || actual.some((key,i)=>key!==expected[i])) return deny();
      const result=await access.execute({...payload,rawRequest:request});
      if (!result || ![200,201,400,401,403,409,429].includes(result.status) || !result.body) return deny();
      return new Response(JSON.stringify(result.body),{status:result.status,headers});
    } catch {return deny();}
  };
}
