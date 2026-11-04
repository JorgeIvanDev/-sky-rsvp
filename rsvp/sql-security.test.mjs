import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Static regression guard only: this does not verify grants in a deployed database.
const sql=readFileSync(new URL('../supabase/001_invitation_rsvps.sql',import.meta.url),'utf8');
const functions=['cnidaria_create_invite(text,text)','cnidaria_reply(uuid,text,text)','cnidaria_get_replies(uuid,text)'];

test('RSVP tables retain RLS and deny direct anonymous/authenticated access',()=>{
 for(const table of ['cnidaria_invites','cnidaria_invite_replies']){
  assert.ok(sql.includes('alter table public.'+table+' enable row level security;'));
  assert.ok(sql.includes('revoke all on public.'+table+' from anon,authenticated;'));
 }
});

test('privileged RSVP RPCs remain explicitly inaccessible to public clients',()=>{
 for(const signature of functions){
  assert.ok(sql.includes('revoke all on function public.'+signature+' from public;'));
  assert.ok(sql.includes('revoke execute on function public.'+signature+' from anon,authenticated;'));
 }
 assert.doesNotMatch(sql.replace(/^\s*--.*$/gm,''),/\bgrant\s+(?:all|execute|select|insert|update|delete)\b/i);
});

test('all three SECURITY DEFINER RPCs pin search_path',()=>{
 const declarations=[...sql.matchAll(/create\s+or\s+replace\s+function\s+public\.cnidaria_\w+\s*\([^]*?\)\s*returns\s+[^]*?\bas\s+\$\$/gi)];
 assert.equal(declarations.length,functions.length);
 for(const declaration of declarations){
  assert.match(declaration[0],/security\s+definer\s+set\s+search_path\s*=\s*''/i);
 }
});
