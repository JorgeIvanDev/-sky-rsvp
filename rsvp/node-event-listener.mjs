// Node HTTP adapter for the private event API. Inject a trusted, server-configured
// createPrivateEventApi router; never accept dependencies from HTTP input.
export function createNodeEventListener(route) {
  if (typeof route !== 'function') throw new TypeError('Trusted event router required');
  return async function listener(req, res) {
    const deny = () => {
      if (!res.headersSent) {
        res.writeHead(403, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end('{"error":"Unavailable"}');
      } else res.destroy();
    };
    try {
      if (!req || !res || !['GET', 'POST'].includes(req.method) ||
          typeof req.url !== 'string' || !req.url.startsWith('/api/')) return deny();
      // Do not trust Host or X-Forwarded-* headers when constructing a Request URL.
      const url = new URL(req.url, 'http://localhost');
      if (url.origin !== 'http://localhost' || url.username || url.password || url.hash) return deny();
      // Reject ambiguous HTTP message framing before creating a Fetch Request.
      // A proxy and Node must never disagree about the request body boundary.
      const rawHeaders = req.headers || {};
      if (rawHeaders['content-length'] !== undefined &&
          rawHeaders['transfer-encoding'] !== undefined) return deny();
      if (rawHeaders['content-encoding'] !== undefined &&
          String(rawHeaders['content-encoding']).toLowerCase() !== 'identity') return deny();
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers || {})) {
        if (Array.isArray(value)) return deny(); // ambiguous duplicate headers
        if (typeof value === 'string') headers.set(name, value);
      }
      const body = req.method === 'POST' ? req : undefined;
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
        'x-content-type-options': 'nosniff'
      });
      res.end(Buffer.from(bytes));
    } catch { deny(); }
  };
}
