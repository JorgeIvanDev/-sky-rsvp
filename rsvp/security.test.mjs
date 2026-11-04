import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRsvpClient,randomSecret} from './client.mjs';

test('RSVP requests never send organizer secret when replying',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>null}};
 const client=createRsvpClient('https://example.supabase.co','public-key',fetcher);
 const replySecret=randomSecret();
 await client.reply('2a861e9d-8752-47b7-bb61-86df31742a39',replySecret,'yes');
 const request=calls[0];
 assert.equal(request.options.method,'POST');
 assert.equal(request.options.headers.apikey,'public-key');
 assert.deepEqual(Object.keys(JSON.parse(request.options.body)).sort(),['p_choice','p_invite_id','p_reply_secret']);
 assert.equal(JSON.parse(request.options.body).p_reply_secret,replySecret);
 assert.equal(request.url.includes(replySecret),false);
});

test('RSVP client fails closed when RPCs are disabled',async()=>{
 const fetcher=async()=>({ok:false,status:403});
 const client=createRsvpClient('https://example.supabase.co','public-key',fetcher);
 await assert.rejects(client.create('Coffee',randomSecret()),/403/);
 await assert.rejects(client.reply('2a861e9d-8752-47b7-bb61-86df31742a39',randomSecret(),'yes'),/403/);
 await assert.rejects(client.getReplies('2a861e9d-8752-47b7-bb61-86df31742a39',randomSecret()),/403/);
});

test('RSVP API requires HTTPS',()=>{
 assert.throws(()=>createRsvpClient('http://example.com','key'),/HTTPS required/);
});

test('invalid RSVP input is rejected before any network request',()=>{
 let calls=0;
 const fetcher=async()=>{calls++;throw Error('Network should not be reached');};
 const client=createRsvpClient('https://example.supabase.co','public-key',fetcher);
 assert.throws(()=>client.create('',randomSecret()),/Invalid invitation title/);
 assert.throws(()=>client.create('Coffee','bad'),/Invalid RSVP secret/);
 assert.throws(()=>client.reply('not-a-uuid',randomSecret(),'yes'),/Invalid invitation ID/);
 assert.throws(()=>client.reply('2a861e9d-8752-47b7-bb61-86df31742a39',randomSecret(),'yes<script>'),/Invalid RSVP choice/);
 assert.throws(()=>client.getReplies('2a861e9d-8752-47b7-bb61-86df31742a39','bad'),/Invalid RSVP secret/);
 assert.equal(calls,0);
});

test('reject API URLs with credentials, query strings, or fragments',()=>{
 for(const url of ['https://user:pass@example.com','https://example.com/?apikey=secret','https://example.com/#secret']){
  assert.throws(()=>createRsvpClient(url,'public-key'),/HTTPS required/);
 }
});
