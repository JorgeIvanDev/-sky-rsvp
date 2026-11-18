import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./direct-challenge.html',import.meta.url),'utf8');
test('Gauntlet game is visible even without a match',()=>{assert.match(html,/<section id="play">/);assert.match(html,/\$\('play'\)\.hidden=false/);assert.doesNotMatch(html,/\$\('play'\)\.hidden=!active/);});
test('inline engine supports solo mode without challenge UUID',()=>{assert.match(html,/const url=id\?'\.\/index\.html\?play=1&gauntlet='/);assert.match(html,/: '\.\/index\.html\?play=1'|:'\.\/index\.html\?play=1'/);assert.doesNotMatch(html,/Choose an accepted active challenge first/);});
test('multiplayer submission remains disabled without an active match',()=>{assert.match(html,/\$\('submit-toss'\)\.removeAttribute\('data-challenge'\);\$\('submit-toss'\)\.disabled=true/);});

test('first-time visitor sees direct PLAY NOW before any sign-in',()=>{
 const play=html.indexOf('▶ PLAY NOW');
 const login=html.indexOf('id="google-login"');
 assert.ok(play>0&&login>0&&play<login,'Play must appear before Google login');
 assert.match(html,/<a class="cta" href="\.\/index\.html\?play=1"[^>]*>▶ PLAY NOW<\/a>/);
});
test('friend challenge remains an optional secondary action',()=>{
 assert.match(html,/href="#challenge-setup"[^>]*>CHALLENGE A FRIEND<\/a>/);
 assert.match(html,/<section id="challenge-setup">/);
});

test('PLAY NOW bypasses title redirect and reaches the original engine',()=>{
 const game=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 assert.match(html, /href="\.\/index\.html\?play=1"[^>]*>▶ PLAY NOW/);
 assert.match(game,/q\.get\('play'\)!=='1'/);
});

test('full-page fallback bypasses title redirect after embedded motion permission failure',()=>{
 assert.match(html, /id="original-engine-link" href="\.\/index\.html\?play=1"/);
 const game=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 assert.match(game,/q\.get\('play'\)!=='1'/);
});
