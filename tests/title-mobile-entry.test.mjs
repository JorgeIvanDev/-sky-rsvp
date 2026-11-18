import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const title=readFileSync(new URL('../title.html',import.meta.url),'utf8');
const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('cinematic title keeps real game, account, leaderboard and invitation routes',()=>{
 for(const [id,path] of [['start','./index.html?play=1'],['account-entry','./direct-challenge.html'],['leaderboard-entry','./index.html?play=1#leaderboard'],['invitations-entry','./index.html?play=1#myInvites']]){
  assert.match(title,new RegExp('id="'+id+'"[^>]*href="'+path.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')+'"'));
 }
 assert.match(game,/id="leaderboard"/);
 assert.match(game,/id="myInvites"/);
});
test('short Safari screens can scroll to account and invitation links',()=>{
 assert.match(title,/main\{height:100dvh;min-height:0;overflow-y:auto/);
 assert.match(title,/@media\(max-height:740px\),\(max-width:390px\)/);
 assert.match(title,/main section\{flex-shrink:0;margin:auto\}/);
});

test('abyss menu remains hidden until cinematic completes',()=>{
 assert.match(title,/not\(\.intro-complete\) #start/);
 assert.match(title,/not\(\.intro-complete\) #account-entry/);
 assert.match(title,/not\(\.intro-complete\) #options/);
 assert.match(title,/setTimeout\(revealMenu,short\?5800:10800\)/);
});
test('mascot, green heartbeat and wordmark cannot regress to offset or overlap',()=>{
 assert.match(title,/<div class="orb"[^>]*><div class="natas-heartbeat"><\/div><div class="natas-flip">/);
 assert.match(title,/\.orb>\.natas-flip,\s*body:not\(\.invitation-intro\) main section>\.orb>\.natas-heartbeat\{\s*grid-area:1\/1!important/);
 assert.match(title,/margin-bottom:58px!important/);
 assert.match(title,/translate:-50% 0!important/);
});
