import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../direct-challenge.html',import.meta.url),'utf8');
const script=html.split('<script type="module">')[1].split('</script>')[0];
function handler(id){const marker="$('"+id+"').onclick=";const start=script.indexOf(marker);assert.ok(start>=0);const end=script.indexOf("\n",start);return script.slice(start,end);}
test('OAuth invitation preview runs even if challenge list refresh fails',()=>{
 assert.match(script,/if\(session\)\{run\(refresh\);if\(invite\)run\(preview\)\}/);
 assert.doesNotMatch(script,/await refresh\(\);await preview\(\)/);
});
test('challenge create unlocks only after confirmed success and locks ambiguous failures',()=>{
 const code=handler('create');
 assert.match(code,/if\(\$\('create'\)\.disabled\)return/);
 assert.match(code,/\$\('create'\)\.disabled=true/);
 assert.match(code,/finally\{if\(creationConfirmed\)\$\('create'\)\.disabled=false\}/);
 assert.match(code,/Challenge creation status unknown/);
});
test('challenge creation rejects expired deadlines before RPC',()=>{
 assert.match(handler('create'),/date\.getTime\(\)<=Date\.now\(\)/);
});
test('successful challenge creation survives a failed list refresh',()=>{
 const code=handler('create');
 assert.match(code,/status\('Challenge created\. Share the link\.'/);
 assert.match(code,/try\{await refresh\(\)\}catch\(e\)/);
});

test('challenge creation refuses missing, malformed and oversized invite tokens',()=>{
 const code=handler('create');
 assert.match(code,/typeof token!=='string'/);
 assert.match(code,/\^\[A-Za-z0-9_-\]\{16,256\}\$/);
 assert.match(code,/Server did not return a valid invitation token/);
});

test('challenge creation caps expiry to 30 days',()=>{assert.match(handler('create'),/30\*86400000/);assert.match(handler('create'),/expiration within 30 days/)});

test('native share failure falls back to clipboard but cancellation does not',()=>{
 const code=handler('native-share');
 assert.match(code,/if\(e\?\.name==='AbortError'\)\{status\('Sharing cancelled\.'\);return\}/);
 assert.match(code,/Share sheet unavailable\. Trying to copy the challenge link/);
 assert.match(code,/if\(!navigator\.clipboard\?\.writeText\)throw Error\('Clipboard unavailable'\)/);
 assert.match(code,/await navigator\.clipboard\.writeText\(url\)/);
 assert.doesNotMatch(code,/Share sheet unavailable\.[^']*'\);return/);
});
