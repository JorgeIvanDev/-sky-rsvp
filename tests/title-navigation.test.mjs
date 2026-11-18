import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const title=readFileSync(new URL('../title.html',import.meta.url),'utf8');
const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const challenges=readFileSync(new URL('../direct-challenge.html',import.meta.url),'utf8');
test('cinematic intro preserves original game entry and visible account route',()=>{
 assert.match(title,/id="start" href="\.\/index\.html\?play=1"/);
 assert.match(title,/id="account-entry" href="\.\/direct-challenge\.html"/);
 assert.match(title,/SIGN IN · MY CHALLENGES & ARCHIVES/);
 assert.match(title,/cnidaria-original-logo\.svg/);
});
test('game exposes invitation shortcut and Hall of Fame without requiring toss',()=>{
 assert.match(game,/id="myInvitesShortcut"/);
 assert.match(game,/id="leaderboard"/);
 assert.match(game,/id="refreshBoard"/);
});
test('account destination exposes real Google sign-in and archives',()=>{
 assert.match(challenges,/id="google-login"/);
 assert.match(challenges,/id="show-archived"/);
 assert.match(challenges,/id="show-removed"/);
});

test('leaderboard has independent failed-initialization fallback',()=>{
 assert.match(game,/Independent watchdog: even a game-script syntax error/);
 assert.match(game,/Scores failed to initialize/);
 assert.match(game,/document\.addEventListener\('visibilitychange'/);
});
