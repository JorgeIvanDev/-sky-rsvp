// Run: node tests/rsvp-create-response-guard.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const marker = "const registered=await rsvpApi({action:'create',title});";
const start = source.indexOf(marker);
assert.ok(start >= 0, 'RSVP create handler must exist');
const end = source.indexOf('const encoded=encodeInvite', start);
assert.ok(end > start, 'Validation must run before encoding and exposing the invite');
const guard = source.slice(start + marker.length, end);
assert.match(guard, /registered\.inviteId/, 'Must validate returned invitation ID');
assert.match(guard, /registered\.hostSecret/, 'Must validate private dashboard key');
const check = new Function('registered', guard + '\nreturn true;');
const valid = {inviteId:'123e4567-e89b-42d3-a456-426614174000',hostSecret:'private-host-token'};
assert.equal(check(valid), true);
for (const [name, response] of Object.entries({
  nullResponse: null,
  missingId: {hostSecret:'secret'},
  invalidId: {inviteId:'not-an-id',hostSecret:'secret'},
  invalidUuidVersion: {inviteId:'123e4567-e89b-02d3-a456-426614174000',hostSecret:'secret'},
  missingSecret: {inviteId:valid.inviteId},
  blankSecret: {inviteId:valid.inviteId,hostSecret:'   '},
  numericSecret: {inviteId:valid.inviteId,hostSecret:123}
})) assert.throws(() => check(response), /Server did not return a valid invitation/, name);
console.log('RSVP create response guard: 8 cases passed');
