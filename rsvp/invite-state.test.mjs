import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicInviteRecord,privateOrganizerRecord,shareableInviteUrl,readInviteId,validateChoice,formatRsvpStatus} from './invite-state.mjs';
const id='2a861e9d-8752-47b7-bb61-86df31742a39';
const secret='a'.repeat(64);
test('public invitation contains no organizer credentials',()=>{
 const pub=publicInviteRecord(id,' Coffee ');
 const privateRecord=privateOrganizerRecord(id,secret);
 assert.deepEqual(pub,{id,title:'Coffee'});
 assert.equal(privateRecord.ownerSecret,secret);
 assert.equal(JSON.stringify(pub).includes(secret),false);
});
test('share URL strips owner capability and preserves existing invitation payload',()=>{
 const link=shareableInviteUrl('https://example.com/invite?data=hello&ownerSecret=oops&owner_secret=oops',{id,title:'Coffee'});
 assert.equal(readInviteId(link),id);
 assert.equal(new URL(link).searchParams.get('data'),'hello');
 assert.equal(link.includes('ownerSecret'),false);
 assert.equal(link.includes('owner_secret'),false);
 assert.equal(link.includes(secret),false);
});
test('reject invalid or duplicate RSVP identifiers',()=>{
 assert.equal(readInviteId('https://example.com/?rsvp=wrong'),null);
 assert.equal(readInviteId('https://example.com/?rsvp='+id+'&rsvp='+id),null);
 assert.throws(()=>publicInviteRecord('bad','Coffee'),/Invalid invitation ID/);
 assert.throws(()=>privateOrganizerRecord(id,'short'),/Invalid organizer credentials/);
 assert.throws(()=>shareableInviteUrl('http://example.com/',{id,title:'Coffee'}),/HTTPS required/);
});
test('RSVP choices are limited and have clear user messages',()=>{
 assert.equal(validateChoice('yes'),'yes');
 assert.match(formatRsvpStatus('maybe'),/update/);
 assert.throws(()=>validateChoice('maybe<script>'),/Invalid RSVP choice/);
});

test('share URL allowlist drops arbitrary keys, fragments, and URL credentials',()=>{
 const url=shareableInviteUrl('https://example.com/invite?data=hello&apiKey=private&session=private&ownerSecret=private#access_token=private',{id,title:'Coffee'});
 assert.equal(url,'https://example.com/invite?data=hello&rsvp='+id);
 assert.equal(url.includes('private'),false);
 assert.throws(()=>shareableInviteUrl('https://user:pass@example.com/',{id,title:'Coffee'}),/HTTPS required/);
});
test('duplicate legacy payloads are not silently chosen',()=>{
 const url=shareableInviteUrl('https://example.com/?data=one&data=two',{id,title:'Coffee'});
 assert.equal(new URL(url).searchParams.has('data'),false);
});
