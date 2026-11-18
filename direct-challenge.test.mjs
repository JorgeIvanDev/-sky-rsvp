import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const h=fs.readFileSync(new URL('./direct-challenge.html',import.meta.url),'utf8');
test('direct challenge has toss submission RPC and stateful UI',()=>{for(const x of ['cnt_submit_direct_toss','p_airtime_ms','p_caught','play-result','submit-toss','cnt_respond_direct_challenge'])assert.ok(h.includes(x),x)});
test('rendering uses textContent, not untrusted HTML',()=>{assert.ok(!h.includes('innerHTML'));assert.ok(h.includes('textContent'))});

test('demo invitation placeholder uses text-only DOM construction',()=>{
 assert.match(h,/const photo=document\.createElement\('div'\);photo\.className='demo-photo'/);
 assert.match(h,/heading\.textContent='THE GAUNTLET'/);
 assert.match(h,/hint\.textContent=/);
 assert.match(h,/photo\.append\(frame\)/);
 assert.doesNotMatch(h,/\.innerHTML\s*=/);
});

test('incoming token preview is not hidden by unrelated accepted or completed challenges',()=>{
  const preview=h.match(/async function preview\(\)\{([\s\S]*?)\nasync function respond/);
  assert.ok(preview,'preview handler exists');
  assert.ok(preview[1].includes("cnt_preview_direct_challenge"));
  assert.ok(!preview[1].includes("current.some"),'other games must not suppress incoming invitation');
  assert.ok(!preview[1].includes("status==='accepted'"),'existing accepted games are unrelated');
});

test('pending OAuth invitation recovery rejects future timestamps and expires within 15 minutes',()=>{
  assert.ok(h.includes('Number.isFinite(saved.at)'));
  assert.ok(h.includes('saved.at<=Date.now()'));
  assert.ok(h.includes('Date.now()-saved.at<15*60*1000'));
});

test('toss submit is single-flight and ambiguous failures require refresh',()=>{assert.match(h,/if\(submitBusy\)return/);assert.match(h,/submitBusy=true/);assert.match(h,/submitBusy=false/);assert.match(h,/Submission status unknown\. Reload this page/);assert.doesNotMatch(h,/if\(!confirmed&&\$\('submit-toss'\)\.dataset\.challenge===id\)\$\('submit-toss'\)\.disabled=false/)});

test('motion sample count includes only accepted trace samples',()=>{assert.match(h,/if\(!motionTrace\.add\(\{timestamp:e\.timeStamp,magnitude\}\)\)return;motionSamples\+\+/);assert.doesNotMatch(h,/motionSamples\+\+;motionPeak=.*?motionTrace\.add/s)});

test('expired accepted challenges cannot be selected for new tosses',()=>{assert.match(h,/r\.status==='accepted'&&Number\.isFinite\(Date\.parse\(r\.expires_at\)\)&&Date\.parse\(r\.expires_at\)>Date\.now\(\)/)});

test('toss submission checks expiry of selected challenge',()=>{assert.ok(h.includes("chosenExpiresAt=activeRows.find"));assert.ok(h.includes("Challenge expired. Refresh your challenges."))});

test('Gauntlet has branded Open Graph metadata from original Natas artwork',()=>{assert.match(h,/og:title/);assert.match(h,/natas-gauntlet-preview\.svg/)});
test('removed matches can be restored without deleting shared records',()=>{assert.match(h,/showRemoved\?hidden\[r\.id\]==='removed'/);assert.match(h,/show-removed.*?onclick/s);assert.match(h,/Open Removed to restore it/)});

test('native challenge share uses invitation URL with safe fallback',()=>{assert.match(h,/id="native-share" disabled/);assert.match(h,/navigator\.share\(\{title:/);assert.match(h,/url\}\)/);assert.match(h,/e\?\.name==='AbortError'/);assert.match(h,/navigator\.clipboard\.writeText\(url\)/)});

test('authenticated challenge list refreshes while page is visible',()=>{assert.match(h,/setInterval\(syncChallenges,12000\)/);assert.match(h,/document\.visibilityState!=='visible'/);assert.match(h,/session\?\.access_token/);assert.match(h,/visibilitychange/)});
test('rematch prepares new deadline and keeps previous result',()=>{assert.match(h,/Rematch prepared\. Press Create challenge/);assert.match(h,/\$\('deadline'\)\.value=new Date\(Date\.now\(\)\+86400000\)/)});

test('Google OAuth callback fails closed on missing refresh token, invalid TTL, or unavailable storage',()=>{
 assert.match(h,/access&&refresh&&Number\.isFinite\(ttl\)&&ttl>0&&ttl<=86400/);
 assert.match(h,/Incomplete Google sign-in response\. Please sign in again\./);
 assert.match(h,/Unable to save Google session\. Enable browser storage/);
 assert.match(h,/history\.replaceState\(null,'',location\.pathname\+location\.search\)/);
});

test('OAuth errors invalidate prior session and cannot be overridden by a token fragment',()=>{
 assert.match(h,/if\(hash\.has\('error'\)\)\{session=null;try\{localStorage\.removeItem\(STORE\)\}/);
 assert.match(h,/if\(!hash\.has\('error'\)&&hash\.has\('access_token'\)\)/);
});
test('refresh response requires both tokens and a bounded expiry, and clears stale credentials on failure',()=>{
 assert.match(h,/!r\.ok\|\|!d\?\.access_token\|\|!d\?\.refresh_token/);
 assert.match(h,/!Number\.isFinite\(ttl\)\|\|ttl<=0\|\|ttl>86400/);
 assert.match(h,/Session expired or refresh response invalid\. Sign in again\./);
 assert.match(h,/Unable to save refreshed session\. Enable browser storage/);
});


test('challenge sync uses one polling timer and one visibility listener',()=>{
 assert.equal((h.match(/setInterval\(syncChallenges,12000\)/g)||[]).length,1);
 assert.equal((h.match(/document\.addEventListener\('visibilitychange'/g)||[]).length,2,'one challenge-sync listener and one motion-interruption listener');
 assert.match(h,/document\.addEventListener\('visibilitychange',\(\)=>\{if\(document\.visibilityState==='visible'\)void syncChallenges\(\)\}\)/);
 assert.match(h,/document\.addEventListener\('visibilitychange',\(\)=>\{if\(document\.visibilityState==='hidden'\)cancelBackgroundMotion\(\)\}\)/);
 assert.doesNotMatch(h,/setInterval\(\(\)=>\{if\(!document\.hidden&&!motionActive\)run\(refresh\)\},20000\)/);
 assert.match(h,/window\.addEventListener\('pagehide',stopChallengePolling\)/);
 assert.match(h,/window\.addEventListener\('pageshow',event=>\{if\(event\.persisted\)\{startChallengePolling\(\);void syncChallenges\(\)\}\}\)/);
});

test('ambiguous invitation responses fail closed rather than enabling a duplicate accept or decline',()=>{
 const response=h.match(/async function respond\(accept\)\{([\s\S]*?)\n\$\('submit-toss'\)/);
 assert.ok(response,'production response handler exists');
 assert.match(response[1],/catch\(e\)\{\$\('accept'\)\.disabled=\$\('decline'\)\.disabled=true/);
 assert.match(response[1],/Response status unknown \(/);
 assert.match(response[1],/Reload this invitation and check Your challenges before retrying/);
 assert.doesNotMatch(response[1],/catch\(e\)\{\$\('accept'\)\.disabled=\$\('decline'\)\.disabled=false/);
});

test('ambiguous challenge creation stays locked until reload to prevent duplicate invitations',()=>{
 const create=h.match(/\$\('create'\)\.onclick=\(\)=>run\(async\(\)=>\{([\s\S]*?)\n\$\('refresh'\)\.onclick/);
 assert.ok(create,'create handler exists');
 assert.match(create[1],/if\(\$\('create'\)\.disabled\)return/);
 assert.match(create[1],/let creationConfirmed=false/);
 assert.match(create[1],/creationConfirmed=true/);
 assert.match(create[1],/if\(creationConfirmed\)\$\('create'\)\.disabled=false/);
 assert.match(create[1],/Challenge creation status unknown\. Do not press Create again/);
 assert.doesNotMatch(create[1],/finally\{\$\('create'\)\.disabled=false\}/);
});


test('copy-link action handles missing or rejected mobile clipboard without losing the invitation URL',()=>{
 const copy=h.match(/\$\('copy'\)\.onclick=\(\)=>run\(async\(\)=>\{([\s\S]*?)\}\);\n\$\('deadline'\)/);
 assert.ok(copy,'production copy-link handler exists');
 assert.match(copy[1],/navigator\.clipboard\?\.writeText/);
 assert.match(copy[1],/catch\{status\('Copy unavailable\. Select the visible challenge URL/);
 assert.match(copy[1],/\$\('share'\)\.textContent\.trim\(\)/);
});


test('ambiguous toss submission remains locked during background refresh',()=>{
 assert.match(h,/uncertainTossChallenge=null/);
 assert.match(h,/uncertainTossChallenge=id/);
 assert.match(h,/\$\('submit-toss'\)\.disabled=submitBusy\|\|!!mine\|\|uncertainTossChallenge===active\.id/);
 assert.match(h,/\$\('airtime'\)\.disabled=submitBusy\|\|!!mine\|\|uncertainTossChallenge===active\.id/);
 assert.match(h,/Reload this page and check challenge history before trying again/);
});

test('polling cannot unlock score controls while submission request is in flight',()=>{
 const refresh=h.match(/async function refresh\(\)\{([\s\S]*?)\nasync function preview/);
 assert.ok(refresh,'production refresh handler exists');
 for(const id of ['submit-toss','airtime','caught']){
  assert.ok(refresh[1].includes("$('"+id+"').disabled=submitBusy||!!mine||uncertainTossChallenge===active.id"),id+' must stay locked');
 }
 assert.match(h,/submitBusy=true;\$\('submit-toss'\)\.disabled=true/);
});

test('challenge photo taunt can be selected and previewed locally',()=>{assert.match(h,/id="taunt-photo" type="file" accept="image\/\*"/);assert.match(h,/URL\.createObjectURL\(file\)/);assert.match(h,/URL\.revokeObjectURL\(tauntObjectUrl\)/);assert.match(h,/12\*1024\*1024/)});
test('taunt card is rendered from chosen photo and shared with invite URL',()=>{assert.match(h,/async function makeTauntCard\(file\)/);assert.match(h,/ctx\.drawImage\(bitmap/);assert.match(h,/new File\(\[blob\],'cnidaria-challenge\.jpg'/);assert.match(h,/async function makeTauntCard\(file\)/);assert.match(h,/navigator\.share\(\{title:/);assert.match(h,/text:'Up for the challenge\? Toss the Gauntlet!'/)});

test('taunt photo upload uses authenticated storage and non-upsert UUID path',()=>{assert.match(h,/TAUNT_BUCKET='cnidaria-taunts'/);assert.match(h,/crypto\.randomUUID\(\)\+'\.jpg'/);assert.match(h,/Authorization:'Bearer '\+session\.access_token/);assert.match(h,/'x-upsert':'false'/)});
test('recipient displays URL-linked photo with strict path validation',()=>{assert.match(h,/id="incoming-taunt"/);assert.match(h,/renderIncomingTaunt\(\)/);assert.match(h,/url\.hash='taunt='/);assert.match(h,/validTauntPath\(path\)/)});

test('photo is uploaded when sharing, even if selected after challenge creation',()=>{assert.match(h,/async function prepareChallengeShare\(\)/);assert.match(h,/const path=await uploadTaunt\(tauntPhoto\)/);assert.match(h,/url\.hash='taunt='/);assert.match(h,/url=await prepareChallengeShare\(\)/);assert.match(h,/const url=\$\('share'\)\.textContent\.trim\(\)\?await prepareChallengeShare\(\):''/)});
test('photo editor falls back when createImageBitmap fails on iPhone',()=>{assert.match(h,/typeof createImageBitmap==='function'/);assert.match(h,/const img=new Image\(\)/);assert.match(h,/URL\.revokeObjectURL\(imageUrl\)/)});

test('create flow has visible direct invitation link and scrolls to result',()=>{assert.match(h,/id="open-share" hidden/);assert.match(h,/\$\('open-share'\)\.href=url\.toString\(\)/);assert.match(h,/\$\('share'\)\.scrollIntoView/)});
test('create validates server seven-day expiry without clearing an existing share link',()=>{assert.match(h,/Choose an expiration within 7 days/);assert.match(h,/date\.getTime\(\)>Date\.now\(\)\+7\*86400000-60000/);const start=h.indexOf("$('create').onclick=");const section=h.slice(start,start+2100);assert.doesNotMatch(section,/\$\('share'\)\.textContent=''/)});

test('invalid create attempt preserves existing invitation link',()=>{const start=h.indexOf("$('create').onclick=");const section=h.slice(start,start+2100);assert.match(section,/Checking challenge/);assert.doesNotMatch(section,/\$\('share'\)\.textContent=''/);assert.match(section,/Creating challenge/)});


test('refresh never rewrites original engine fallback to title redirect',()=>{
 assert.match(h,/\$\('original-engine-link'\)\.href=selected\?'\.\/index\.html\?play=1&gauntlet='\+encodeURIComponent\(selected\):'\.\/index\.html\?play=1'/);
 assert.doesNotMatch(h,/\$\('original-engine-link'\)\.href=selected\?'\.\/index\.html\?gauntlet='/);
});
