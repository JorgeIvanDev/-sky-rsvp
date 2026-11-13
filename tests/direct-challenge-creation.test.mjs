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
test('challenge create disables during network request and re-enables after failures',()=>{
 const code=handler('create');
 assert.match(code,/if\(\$\('create'\)\.disabled\)return/);
 assert.match(code,/\$\('create'\)\.disabled=true/);
 assert.match(code,/finally\{\$\('create'\)\.disabled=false\}/);
});
test('challenge creation rejects expired deadlines before RPC',()=>{
 assert.match(handler('create'),/date\.getTime\(\)<=Date\.now\(\)/);
});
test('successful challenge creation survives a failed list refresh',()=>{
 const code=handler('create');
 assert.match(code,/status\('Challenge created\. Share the link\.'/);
 assert.match(code,/try\{await refresh\(\)\}catch\(e\)/);
});
