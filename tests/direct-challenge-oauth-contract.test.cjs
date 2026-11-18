// Regression contract for the live direct-challenge Google OAuth return path.
// Run: node --test tests/direct-challenge-oauth-contract.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'direct-challenge.html'), 'utf8');
test('Google sign-in returns to the direct challenge page', () => {
  assert.match(html, /id="google-login"[^>]+href="https:\/\/hwkxuczipnaqzhbnaurw\.supabase\.co\/auth\/v1\/authorize\?provider=google&redirect_to=https%3A%2F%2Fjorgeivandev\.github\.io%2F-sky-rsvp%2Fdirect-challenge\.html"/);
});
test('pending invite survives same-tab OAuth round trip with bounded lifetime', () => {
  assert.match(html, /sessionStorage\.setItem\(PENDING,JSON\.stringify\(\{token:invite,at:Date\.now\(\)\}\)\)/);
  assert.match(html, /Date\.now\(\)-saved\.at<15\*60\*1000/);
  assert.match(html, /restored\.searchParams\.set\('challenge',invite\)/);
});
test('invalid invite tokens cannot be restored', () => {
  assert.match(html, /\^\[A-Za-z0-9_-\]\{16,256\}\$/);
});
test('OAuth fragments are stripped from history on success and failure', () => {
  assert.match(html, /if\(hash\.has\('error'\)\)/);
  assert.match(html, /if\(!hash\.has\('error'\)&&hash\.has\('access_token'\)\)/);
  assert.equal((html.match(/history\.replaceState\(null,'',location\.pathname\+location\.search\)/g)||[]).length >= 2, true);
});
test('session refresh is bounded and uses authenticated bearer requests', () => {
  assert.match(html, /ttl>86400/);
  assert.match(html, /Authorization:'Bearer '\+session\.access_token/);
  assert.match(html, /session\.expires_at-60000/);
});
