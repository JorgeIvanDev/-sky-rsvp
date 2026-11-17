import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const title=readFileSync(new URL('../title.html',import.meta.url),'utf8');
const logo=readFileSync(new URL('../assets/cnidaria-jellyfish-green.svg',import.meta.url),'utf8');

test('approved jellyfish uses dedicated original-eye artwork',()=>{
 assert.match(title,/class="natas-green-logo" src="\.\/assets\/cnidaria-jellyfish-green\.svg"/);
 assert.match(logo,/fill="#020509"/);
 assert.match(title,/body\.invitation-intro \.natas-green-logo\{transform:rotate\(180deg\)!important\}/);
 assert.doesNotMatch(title,/<span class="jelly-eye"/);
});
test('invitation preloads before Reveal and keeps Skip destination',()=>{
 assert.match(title,/const warmPreview=\(\)=>/);
 assert.match(title,/setTimeout\(warmPreview,next==='invitation-preview'\?7500/);
 assert.match(title,/skip\.addEventListener\('click',[\s\S]*?location\.replace\(destination\)/);
 assert.match(title,/const destination=next==='invitation-preview'\?'\.\/direct-challenge\.html\?preview=1&from=intro'/);
});
test('Matrix letters hold before feathered top-to-bottom reveal',()=>{
 assert.match(title,/setTimeout\(\(\)=>document\.body\.classList\.add\('preview-revealed'\),1650\)/);
 assert.match(title,/@keyframes matrixFeatherReveal/);
 assert.match(title,/--matrix-wipe:110%/);
 assert.match(title,/next==='invitation-preview'\?3050:2700/);
 assert.doesNotMatch(title,/id="glyph-curtain"/);
});
