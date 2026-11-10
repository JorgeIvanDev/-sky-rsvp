// Node HTTP adapter for the private event API. Inject a trusted, server-configured
// createPrivateEventApi router; never accept dependencies from HTTP input.
export function createNodeEventListener(route, { publicOrigin = 'http://localhost' } = {}) {
  if (typeof route !== 'function') throw new TypeError('Trusted event router required');
  // Use a deployment-configured origin, never the untrusted Host header.
  const trustedOrigin = new URL(publicOrigin);
  if (!['http:', 'https:'].includes(trustedOrigin.protocol) || trustedOrigin.username ||
      trustedOrigin.password || trustedOrigin.pathname !== '/' || trustedOrigin.search || trustedOrigin.hash)
    throw new TypeError('Invalid trusted public origin');
  return async function listener(req, res) {
    const deny = () => {
      if (!res.headersSent) {
        res.writeHead(403, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer'
        });
        res.end('{"error":"Unavailable"}');
      } else res.destroy();
    };
    try {
      if (!req || !res || !['GET', 'POST'].includes(req.method) ||
          typeof req.url !== 'string' || !req.url.startsWith('/api/')) return deny();
      // Do not trust Host or X-Forwarded-* headers when constructing a Request URL.
      const url = new URL(req.url, trustedOrigin.origin);
      if (url.origin !== trustedOrigin.origin || url.username || url.password || url.hash) return deny();
      // Reject ambiguous HTTP message framing before creating a Fetch Request.
      // A proxy and Node must never disagree about the request body boundary.
      const rawHeaders = req.headers || {};
      // Node may coalesce or discard duplicate wire headers in req.headers.
      // Reject duplicate security-sensitive headers using the original wire list.
      // In particular, never let a proxy and the app select different bearer
      // tokens, cookies, content types, or message boundaries.
      if (req.rawHeaders !== undefined) {
        if (!Array.isArray(req.rawHeaders) || req.rawHeaders.length % 2 !== 0) return deny();
        const sensitive = new Set(['authorization', 'cookie', 'content-length',
          'transfer-encoding', 'content-type', 'content-encoding']);
        const seen = new Set();
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          const name = req.rawHeaders[i];
          // Reject non-token wire header names rather than allowing whitespace or
          // non-ASCII variants to evade the sensitive-header duplicate check.
          if (typeof name !== 'string' || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name))
            return deny();
          const normalized = name.toLowerCase();
          if (sensitive.has(normalized)) {
            if (seen.has(normalized)) return deny();
            seen.add(normalized);
          }
        }
      }
      if (rawHeaders['content-length'] !== undefined &&
          rawHeaders['transfer-encoding'] !== undefined) return deny();
      // Refuse oversized declared bodies before forwarding to the private router.
      // Enforce the same limit on actual streamed bytes, including chunked bodies.
      if (rawHeaders['content-length'] !== undefined) {
        const length = rawHeaders['content-length'];
        if (typeof length !== 'string' || !/^(0|[1-9][0-9]*)$/.test(length) ||
            !Number.isSafeInteger(Number(length)) || Number(length) > 16384) return deny();
      }
      if (rawHeaders['content-encoding'] !== undefined &&
          String(rawHeaders['content-encoding']).toLowerCase() !== 'identity') return deny();
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers || {})) {
        if (Array.isArray(value)) return deny(); // ambiguous duplicate headers
        if (typeof value === 'string') headers.set(name, value);
      }
      // Bound actual bytes before invoking trusted application code. A missing or
      // forged Content-Length must not bypass the limit on chunked uploads.
      let body;
      if (req.method === 'POST') {
        const chunks = [];
        let total = 0;
        for await (const chunk of req) {
          if (!(typeof chunk === 'string' || chunk instanceof Uint8Array)) return deny();
          const bytes = Buffer.from(chunk);
          total += bytes.byteLength;
          if (total > 16384) return deny();
          chunks.push(bytes);
        }
        if (rawHeaders['content-length'] !== undefined &&
            total !== Number(rawHeaders['content-length'])) return deny();
        body = Buffer.concat(chunks, total);
      }
      const request = new Request(url.href, {
        method: req.method, headers, body, ...(body ? { duplex: 'half' } : {})
      });
      const response = await route(request);
      if (!(response instanceof Response)) return deny();
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 65536) return deny();
      res.writeHead(response.status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer'
      });
      res.end(Buffer.from(bytes));
    } catch { deny(); }
  };
}
