import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./direct-challenge.html',import.meta.url),'utf8');
test('Gauntlet game is visible even without a match',()=>{assert.match(html,/<section id="play">/);assert.match(html,/\$\('play'\)\.hidden=false/);assert.doesNotMatch(html,/\$\('play'\)\.hidden=!active/);});
test('inline engine supports solo mode without challenge UUID',()=>{assert.match(html,/const url=id\?'\.\/index\.html\?play=1&gauntlet='/);assert.match(html,/: '\.\/index\.html\?play=1'|:'\.\/index\.html\?play=1'/);assert.doesNotMatch(html,/Choose an accepted active challenge first/);});
test('multiplayer submission remains disabled without an active match',()=>{assert.match(html,/\$\('submit-toss'\)\.removeAttribute\('data-challenge'\);\$\('submit-toss'\)\.disabled=true/);});
