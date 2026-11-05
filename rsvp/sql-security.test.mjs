import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Static regression guard only: this does not verify grants in a deployed database.
// Strip SQL line and block comments before checking security statements.
// This is a static guard, not a full SQL parser or deployed-permission audit.
const stripSqlComments = source => source
 .replace(/\/\*[\s\S]*?\*\//g,'')
 .replace(/--[^\r\n]*/g,'');
const sql=stripSqlComments(readFileSync(new URL('../supabase/001_invitation_rsvps.sql',import.meta.url),'utf8'));
const functions=['cnidaria_create_invite(text,text)','cnidaria_reply(uuid,text,text)','cnidaria_get_replies(uuid,text)'];
// Discover every declared privileged function, so a newly added RPC cannot
// silently bypass this guard just because its name was not added to a list.
const declared=[...sql.matchAll(/create\s+or\s+replace\s+function\s+public\.(cnidaria_\w+)\s*\(([^)]*)\)/gi)];
const signatures=declared.map(([,name,args])=>name+'('+args.split(',').map(a=>a.trim().split(/\s+/).at(-1)).join(',')+')');


test('RSVP tables retain RLS and deny direct anonymous/authenticated access',()=>{
 for(const table of ['cnidaria_invites','cnidaria_invite_replies']){
  assert.ok(sql.includes('alter table public.'+table+' enable row level security;'));
  assert.ok(sql.includes('revoke all on public.'+table+' from anon,authenticated;'));
 }
});

test('privileged RSVP RPCs remain explicitly inaccessible to public clients',()=>{
 assert.equal(new Set(signatures).size,signatures.length,'duplicate privileged RPC declarations');
 assert.deepEqual([...signatures].sort(),[...functions].sort(),'review new privileged RPCs explicitly');
 for(const signature of signatures){
  assert.ok(sql.includes('revoke all on function public.'+signature+' from public;'));
  assert.ok(sql.includes('revoke execute on function public.'+signature+' from anon,authenticated;'));
 }
 assert.doesNotMatch(sql,/\bgrant\s+(?:all|execute|select|insert|update|delete)\b/i);
});

test('all three SECURITY DEFINER RPCs pin search_path',()=>{
 const declarations=[...sql.matchAll(/create\s+or\s+replace\s+function\s+public\.cnidaria_\w+\s*\([^]*?\)\s*returns\s+[^]*?\bas\s+\$\$/gi)];
 assert.equal(declarations.length,signatures.length);
 for(const declaration of declarations){
  assert.match(declaration[0],/security\s+definer\s+set\s+search_path\s*=\s*''/i);
 }
});

test('RPC revocations follow definitions so default EXECUTE cannot be restored by later CREATE',()=>{
 for(const signature of signatures){
  const name=signature.slice(0,signature.indexOf('('));
  const createPattern=new RegExp('\\bcreate\\s+or\\s+replace\\s+function\\s+public\\.'+name+'\\s*\\(','gi');
  const declarations=[...sql.matchAll(createPattern)];
  assert.equal(declarations.length,1,'exactly one definition required for '+name);
  const declarationAt=declarations[0].index;
  const revokePublic='revoke all on function public.'+signature+' from public;';
  const revokeRoles='revoke execute on function public.'+signature+' from anon,authenticated;';
  assert.ok(sql.lastIndexOf(revokePublic)>declarationAt,'PUBLIC revocation must follow '+name);
  assert.ok(sql.lastIndexOf(revokeRoles)>declarationAt,'role revocation must follow '+name);
 }
});

test('commented-out permission revocations cannot satisfy the security guard',()=>{
 const commented='-- revoke execute on function public.cnidaria_reply(uuid,text,text) from anon,authenticated;';
 const stripped=stripSqlComments(commented);
 assert.equal(stripped.trim(),'');
 assert.ok(sql.includes('revoke execute on function public.cnidaria_reply(uuid,text,text) from anon,authenticated;'));
});

test('RSVP migration cannot introduce permissive RLS policies or disable RLS',()=>{
 // Fail closed: privileged server mediation is required until reviewed APIs exist.
 assert.doesNotMatch(sql,/\bcreate\s+(?:or\s+replace\s+)?policy\b/i);
 assert.doesNotMatch(sql,/\balter\s+table\s+(?:if\s+exists\s+)?public\.cnidaria_(?:invites|invite_replies)\s+disable\s+row\s+level\s+security\b/i);
 assert.doesNotMatch(sql,/\balter\s+table\s+(?:if\s+exists\s+)?public\.cnidaria_(?:invites|invite_replies)\s+no\s+force\s+row\s+level\s+security\b/i);
});

test('block-commented revocations and inline comments cannot spoof security assertions',()=>{
 const fake='/* revoke execute on function public.cnidaria_reply(uuid,text,text) from anon,authenticated; */';
 assert.equal(stripSqlComments(fake).trim(),'');
 assert.equal(stripSqlComments('select 1; -- revoke all on public.cnidaria_invites from anon,authenticated;').trim(),'select 1;');
 assert.equal(stripSqlComments('/* start\n revoke all on public.cnidaria_invites from anon,authenticated;\n end */').trim(),'');
});
