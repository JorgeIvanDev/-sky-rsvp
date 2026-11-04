import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('invitation URL payloads are protected by a no-referrer policy',()=>{
 assert.match(html,/<meta\s+name="referrer"\s+content="no-referrer">/);
});

test('guest reveal requires a completed challenge attempt',()=>{
 assert.match(html,/function revealInvite\(\)\{if\(!incoming\|\|!challengeAttempted\)return;/);
 assert.match(html,/id="safeReveal" disabled/);
 assert.match(html,/function complete\(feet,catchLike\)/);
 assert.match(html,/unlockChallengeContent\(\);if\(incoming\)revealInvite\(\)/);
});

test('invite creation and sharing require a completed attempt',()=>{
 assert.match(html,/id="makeInvite" disabled/);
 assert.match(html,/\$\('makeInvite'\)\.onclick=\(\)=>\{if\(!challengeAttempted\)/);
 assert.match(html,/\$\('shareInviteLink'\)\.onclick=async\(\)=>\{if\(!challengeAttempted\|\|!latestInviteUrl\)return;/);
});
