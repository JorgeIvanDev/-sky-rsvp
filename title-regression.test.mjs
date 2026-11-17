import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const title = readFileSync(new URL('./title.html', import.meta.url), 'utf8');
const logo = readFileSync(new URL('./assets/cnidaria-original-logo.svg', import.meta.url), 'utf8');

test('intro retains approved hexagon-free Natas logo', () => {
  assert.match(title, /assets\/cnidaria-original-logo\.svg/);
  assert.doesNotMatch(logo, /M150 8 288 87 284 244 150 322/);
});

test('flip precedes face reveal on both intro lengths', () => {
  const flip = title.match(/setTimeout\(\(\)=>mascot\.classList\.add\('is-flipped'\),short\?(\d+):(\d+)\)/);
  const face = title.match(/setTimeout\(\(\)=>mascot\.classList\.add\('is-facing'\),short\?(\d+):(\d+)\)/);
  assert.ok(flip && face, 'both timed steps must be present');
  assert.ok(Number(flip[1]) < Number(face[1]));
  assert.ok(Number(flip[2]) < Number(face[2]));
  assert.match(title, /\.natas-flip\.is-flipped\{transform:rotateX\(180deg\)!important\}/);
});

test('start transition keeps code rain above game and removes overlay after reveal', () => {
  assert.match(title, /body\.entering #rain\{z-index:5/);
  assert.match(title, /body\.entering #game-preview\{z-index:4/);
  assert.match(title, /document\.getElementById\('rain'\)\.style\.display='none'/);
  assert.match(title, /preview\.style\.pointerEvents='auto'/);
});

test('skip and reduced motion have direct game navigation', () => {
  assert.match(title, /skip\.addEventListener\('click'/);
  assert.match(title, /location\.replace\(destination\)/);
  assert.match(title, /prefers-reduced-motion:reduce/);
});
