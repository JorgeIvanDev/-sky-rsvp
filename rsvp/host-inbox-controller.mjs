// Host-only inbox controller for a trusted same-origin API. No bearer tokens,
// guest identities, or responses are written to localStorage or invitation URLs.
import { createTrustedHostInboxClient } from './trusted-host-inbox-client.mjs';
import { renderReplySummary } from './dashboard.mjs';

export function createHostInboxController({ root, status, fetcher, getAccessToken }) {
  if (!root || typeof root.replaceChildren !== 'function' ||
      !status || !('textContent' in status))
    throw new TypeError('Host inbox elements required');
  const read = createTrustedHostInboxClient({ fetcher, getAccessToken });
  let generation = 0;
  function clear() {
    generation++;
    root.replaceChildren();
    status.textContent = '';
  }
  async function refresh(inviteId) {
    const current = ++generation;
    root.replaceChildren();
    status.textContent = 'Loading private responses…';
    try {
      const responses = await read(inviteId);
      if (current !== generation) return false;
      renderReplySummary(root, responses);
      status.textContent = responses.length === 0
        ? 'No responses yet.' : 'Showing ' + responses.length + ' recent responses.';
      return true;
    } catch {
      if (current === generation) {
        root.replaceChildren();
        status.textContent = 'Private inbox unavailable. Sign in as the host and try again.';
      }
      return false;
    }
  }
  return Object.freeze({ refresh, clear });
}
