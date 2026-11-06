import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';

const directory = new URL('../supabase/', import.meta.url);
const files = readdirSync(directory).filter(name => name.endsWith('.sql'));
const protectedRpc = /\bcnidaria_(?:create_invite|reply|get_replies)\b/i;

const stripComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--[^\r\n]*/g, '');

test('all SQL migrations are reviewed for accidental public RSVP RPC grants', () => {
  assert.ok(files.length > 0, 'expected Supabase SQL migrations');
  for (const filename of files) {
    const sql = stripComments(readFileSync(new URL(filename, directory), 'utf8'));
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const statement of statements) {
      if (!/^grant\s+(?:all|execute)\b/i.test(statement)) continue;
      assert.doesNotMatch(statement, protectedRpc, filename + ' grants privileged RSVP execution');
      assert.doesNotMatch(statement, /\bto\s+(?:public|anon|authenticated)\b/i,
        filename + ' contains a public-facing GRANT requiring explicit security review');
    }
  }
});

test('later SQL migrations cannot silently restore public RSVP execution through default grants', () => {
  for (const filename of files) {
    const sql = stripComments(readFileSync(new URL(filename, directory), 'utf8'));
    assert.doesNotMatch(sql, /\balter\s+default\s+privileges\b[^;]*\bgrant\b[^;]*\bto\s+(?:public|anon|authenticated)\b/i,
      filename + ' changes public default privileges');
  }
});
