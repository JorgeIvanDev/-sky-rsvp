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
