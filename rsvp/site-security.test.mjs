import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('invitation URL payloads are protected by a no-referrer policy',()=>{
 assert.match(html,/<meta\s+name="referrer"\s+content="no-referrer">/);
});

test('guest reveal and RSVP require a challenge attempt while legacy links remain parseable',()=>{
 assert.match(html,/function revealInvite\(options=\{\}\)\{if\(!incoming\|\|!challengeAttempted\)return;/);
 assert.match(html,/\$\('safeReveal'\)\.onclick=\(\)=>\{if\(!challengeAttempted\)/);
 assert.match(html,/unlockChallengeContent\(\);/);
 assert.match(html,/fragmentValues=new URLSearchParams\(location\.hash\.slice\(1\)\)\.getAll\('invite'\)/);
});

test('invite creation is guarded and sharing only exposes an already-created link',()=>{
 assert.match(html,/\$\('makeInvite'\)\.onclick=async\(\)=>\{if\(inviteCreatePending\)return;if\(!challengeAttempted\)/);
 assert.match(html,/\$\('shareInviteLink'\)\.onclick=async\(\)=>\{if\(!latestInviteUrl\)return;/);
 assert.match(html,/\$\('makeInvite'\)\.disabled=false;/);
});

// Avoid first-value-wins parsing when a URL contains competing invite payloads.
test('ambiguous invitation URLs fail closed rather than selecting an arbitrary payload',()=>{
 assert.match(html,/fragmentValues=new URLSearchParams\(location\.hash\.slice\(1\)\)\.getAll\('invite'\)/);
 assert.match(html,/legacyValues=query\.getAll\('invite'\)/);
 assert.match(html,/fragmentValues\.length>1\|\|legacyValues\.length>1\|\|fragmentValues\.length&&legacyValues\.length/);
 assert.match(html,/throw Error\('Ambiguous invitation link'\)/);
});

// Validate before atob so malformed and oversized payloads fail cheaply.
test('invite decoder rejects oversized and malformed base64url input before decoding',()=>{
 assert.match(html,/function decodeInvite\(str\)\{if\(typeof str!=='string'\|\|str\.length>1500/);
 assert.match(html,/!\/\^\[A-Za-z0-9_-\]\+\$\/\.test\(str\)/);
 assert.match(html,/str\.length%4===1\)throw Error\('Invalid invite encoding'\)/);
 assert.match(html,/if\(encoded\.length>1500\)throw Error\('Link too long'\)/);
});

test('prototype does not collect contact details or claim an RSVP was sent',()=>{
 assert.doesNotMatch(html,/localStorage\.setItem\('cnidariaRSVP'/);
 assert.doesNotMatch(html,/id="form"|id="email"|id="name"/);
 assert.doesNotMatch(html,/SAVE RSVP ON THIS DEVICE/);
 assert.match(html,/Secure in-app RSVP is not available yet/);
 assert.match(html,/No RSVP has been transmitted by this page/);
 assert.match(html,/COPY RESPONSE or SHARE RESPONSE/);
});
