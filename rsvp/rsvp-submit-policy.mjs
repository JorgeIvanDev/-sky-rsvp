// Server-side RSVP request gate, pure validation only. Not an exposed endpoint.
// The caller MUST authenticate the recipient, enforce distributed rate limits,
// verify a consumed challenge in the same transaction, and authorize organizer reads.
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex = /^[a-f0-9]{64}$/;
const choices = new Set(['yes', 'maybe', 'no']);
const keys = ['inviteId', 'recipientId', 'challengeId', 'idempotencyKey', 'choice'];
export function validateRsvpSubmission(input) {
  try {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) throw Error();
    if (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) throw Error();
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Reflect.ownKeys(descriptors).length !== keys.length) throw Error();
    const values = {};
    for (const key of keys) {
      if (!own(descriptors, key) || !own(descriptors[key], 'value') ||
          typeof descriptors[key].value !== 'string') throw Error();
      values[key] = descriptors[key].value;
    }
    if (!uuid.test(values.inviteId) || !uuid.test(values.recipientId) ||
        !uuid.test(values.challengeId) || !hex.test(values.idempotencyKey) ||
        !choices.has(values.choice)) throw Error();
    return Object.freeze(values);
  } catch {
    throw new Error('Invalid RSVP submission');
  }
}
