import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';

const directory = new URL('../supabase/', import.meta.url);
const files = readdirSync(directory).filter(name => name.endsWith('.sql'));
const protectedRpc = /\bcnidaria_(?:create_invite|reply|get_replies)\b/i;
const publicRole = /^(?:public|anon|authenticated)$/i;
const grantsToPublicRole = statement => {
  const match = statement.match(/\bto\s+(.+?)(?:\s+with\s+grant\s+option)?\s*$/is);
  return !!match && match[1].split(',').some(role => publicRole.test(role.trim().replace(/^\"|\"$/g, '')));
};

const stripComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--[^\r\n]*/g, '');

test('all SQL migrations are reviewed for accidental public RSVP RPC grants', () => {
  assert.ok(files.length > 0, 'expected Supabase SQL migrations');
  for (const filename of files) {
    const sql = stripComments(readFileSync(new URL(filename, directory), 'utf8'));
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const statement of statements) {
      if (!/^grant\s+(?:all(?:\s+privileges)?|execute)\b/i.test(statement)) continue;
      assert.doesNotMatch(statement, protectedRpc, filename + ' grants privileged RSVP execution');
      assert.equal(grantsToPublicRole(statement), false,
        filename + ' contains a public-facing GRANT requiring explicit security review');
    }
  }
});

test('later SQL migrations cannot silently restore public RSVP execution through default grants', () => {
  for (const filename of files) {
    const sql = stripComments(readFileSync(new URL(filename, directory), 'utf8'));
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) {
      if (!/^alter\s+default\s+privileges\b/i.test(statement)) continue;
      if (!/\bgrant\b/i.test(statement)) continue;
      assert.equal(grantsToPublicRole(statement), false, filename + ' changes public default privileges');
    }
  }
});

test('grant parser rejects quoted and multi-grantee public roles', () => {
  for (const statement of [
    'GRANT EXECUTE ON FUNCTION public.example() TO "authenticated"',
    'GRANT ALL PRIVILEGES ON TABLE public.example TO service_role, anon',
    'GRANT EXECUTE ON FUNCTION public.example() TO service_role, "PUBLIC" WITH GRANT OPTION',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role, "authenticated"',
  ]) assert.equal(grantsToPublicRole(statement), true, statement);
  assert.equal(grantsToPublicRole('GRANT EXECUTE ON FUNCTION public.example() TO service_role'), false);
});
