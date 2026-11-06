import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeHostInboxPreflight as allow } from './host-inbox-authorization.mjs';
const id = n => `123e4567-e89b-42d3-a456-42661417400${n}`;
const valid = () => ({ principal: { userId: id(0) }, invite: { id: id(1), ownerUserId: id(0), deletedAt: null }, query: { inviteId: id(1), limit: 20 } });
test('only matching authenticated host and invite pass preflight', () => {
 assert.equal(allow(valid()), true);
 for (const [section, key, value] of [['principal','userId',id(2)],['invite','ownerUserId',id(2)],['query','inviteId',id(2)],['invite','deletedAt',1234],['query','limit',0],['query','limit',51],['query','limit',1.5]]) {
  const v = valid(); v[section][key] = value; assert.equal(allow(v), false, `${section}.${key}`);
 }
});
test('reject forged roles, injected filters, and hostile objects without throwing', () => {
 assert.equal(allow(null), false);
 assert.equal(allow({...valid(), admin:true}), false);
 for (const section of ['principal','invite','query']) {
  const a=valid();a[section].role='admin';assert.equal(allow(a),false);
  const b=valid();b[section]=new Proxy(b[section],{ownKeys(){throw Error('hostile')}});assert.equal(allow(b),false);
  const c=valid();Object.defineProperty(c[section],Object.keys(c[section])[0],{get(){throw Error('getter')}});assert.equal(allow(c),false);
 }
 assert.equal(allow(new Proxy(valid(), {ownKeys(){throw Error('hostile')}})), false);
});

test('accepts plain own data properties and rejects accessor or symbol smuggling', () => {
 const good = valid();
 assert.equal(allow(good), true, 'plain string, null and number descriptors are valid');
 const accessor = valid();
 Object.defineProperty(accessor.query, 'limit', { enumerable: true, get: () => 20 });
 assert.equal(allow(accessor), false);
 const hidden = valid();
 Object.defineProperty(hidden.query, 'filter', { value: 'all', enumerable: false });
 assert.equal(allow(hidden), false);
 const symbol = valid();
 symbol.query[Symbol('scope')] = 'all';
 assert.equal(allow(symbol), false);
});
