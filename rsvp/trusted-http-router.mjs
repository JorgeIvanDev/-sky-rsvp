// Trusted server runtime bridge: mount this behind /api on a server with verified
// authentication, private database dependencies, and server-side rate limiting.
// This module does not expose database credentials or a public Supabase RPC.
export function createRsvpHttpRouter({ submitRsvp, getHostInbox }) {
  if (typeof submitRsvp !== 'function' || typeof getHostInbox !== 'function')
    throw new TypeError('Trusted handlers required');
  const deny = () => new Response(JSON.stringify({ error: 'Unavailable' }), {
    status: 403, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
  return async function route(request) {
    try {
      if (!(request instanceof Request)) return deny();
      const url = new URL(request.url);
      const path = url.pathname;
      if (path !== '/api/rsvp' && path !== '/api/host-inbox') return deny();
      // These endpoints never accept URL credentials or fragments. RSVP identity
      // and intent must come from verified auth and the validated JSON body.
      if (url.username || url.password || url.hash) return deny();
      if (path === '/api/rsvp' && url.search) return deny();
      // Fail closed on request encodings the router does not decode. A GET inbox
      // request must not carry an ambiguous body or transfer framing.
      // Never forward ambiguous HTTP framing to trusted RSVP handlers. Proxies
      // must normalize transfer framing before this application boundary.
      if (request.headers.has('transfer-encoding')) return deny();
      const encoding = request.headers.get('content-encoding');
      if (encoding !== null && encoding.trim().toLowerCase() !== 'identity') return deny();
      if (path === '/api/host-inbox' && (request.body !== null || request.headers.has('transfer-encoding') ||
          (request.headers.has('content-length') && request.headers.get('content-length') !== '0'))) return deny();
      let input;
      if (path === '/api/rsvp') {
        // Require an unambiguous UTF-8 JSON media type. Do not accept arbitrary
        // parameters (including conflicting charsets) that proxies may parse differently.
        const contentType = request.headers.get('content-type');
        if (request.method !== 'POST' || !contentType ||
            !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|\"utf-8\"))?\s*$/i.test(contentType))
          return deny();
        // Cap before JSON parsing, including streamed requests without Content-Length.
        const declared = request.headers.get('content-length');
        if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 8192)) return deny();
        const reader = request.body?.getReader();
        if (!reader) return deny();
        const chunks = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 8192) { await reader.cancel(); return deny(); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        // Reject declared/actual length disagreement before invoking trusted handlers.
        // Never allow a truncated or padded body to reach the RSVP transaction.
        if (declared !== null && Number(declared) !== size) return deny();
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        input = { method: 'POST', headers: request.headers, body: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), rawRequest: request };
      } else {
        if (request.method !== 'GET' || [...url.searchParams.keys()].some(k => !['inviteId', 'limit'].includes(k)) ||
            url.searchParams.getAll('inviteId').length !== 1 || url.searchParams.getAll('limit').length !== 1)
          return deny();
        const limit = url.searchParams.get('limit');
        const inviteId = url.searchParams.get('inviteId');
        if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(inviteId)) return deny();
        if (!/^[1-9]\d?$/.test(limit) || Number(limit) > 50) return deny();
        input = { method: 'GET', headers: request.headers, rawRequest: request,
          query: { inviteId: url.searchParams.get('inviteId'), limit: Number(limit) } };
      }
      // Auth implementations must validate the bearer token cryptographically using
      // rawRequest; do not treat headers or request.body as verified identity.
      const result = await (path === '/api/rsvp' ? submitRsvp(input) : getHostInbox(input));
      if (!result || result.status !== 200 || !result.body) return deny();
      return new Response(JSON.stringify(result.body), {
        status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    } catch { return deny(); }
  };
}
