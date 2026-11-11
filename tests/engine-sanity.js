// Check inline JavaScript syntax and catch-engine invariants without a browser.
// Run: node tests/engine-sanity.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
assert.ok(scripts.length>0,'No inline scripts found');
for(let i=0;i<scripts.length;i++){
 try{new Function(scripts[i])}catch(e){throw new Error('Inline script '+(i+1)+' syntax: '+e.message)}
}
const motion=html.slice(html.indexOf('function motion(e){'),html.indexOf('async function submitScore('));
assert.ok(motion.startsWith('function motion(e){'),'Motion handler missing');
for(const [name,pattern] of [
 ['sustained freefall',/freefallMs<250/],
 ['consecutive strong impacts',/impactCount=0/],
 ['gentle stable readings',/gentleSettleSamples>=3/],
 ['spin excludes catch impact',/if\(r&&m<2\.5\)/],
 ['first impact height',/complete\(firstImpactFeet,true\)/],
 ['sensor gap guard',/now-lastMotionAt>250/]
])assert.match(motion,pattern,name+' invariant missing');
console.log('PASS: '+scripts.length+' inline scripts parse and engine guards present');
