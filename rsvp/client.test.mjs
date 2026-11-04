import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomSecret,createRsvpClient} from './client.mjs';
test('secrets are 256-bit hex and independent',()=>{
 const a=randomSecret(),b=randomSecret();
 assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);
});
test('RPC requests use only expected fields',async()=>{
 const requests=[];
 const fetcher=async(url,options)=>{requests.push({url,options});return {ok:true,status:200,json:async()=>({ok:true})}};
 const client=createRsvpClient('https://example.supabase.co','publishable',fetcher);
 await client.create('Coffee','a'.repeat(64));
 await client.reply('2a861e9d-8752-47b7-bb61-86df31742a39','b'.repeat(64),'yes');
 await client.getReplies('2a861e9d-8752-47b7-bb61-86df31742a39','a'.repeat(64));
 assert.deepEqual(requests.map(r=>r.url.split('/').pop()),['cnidaria_create_invite','cnidaria_reply','cnidaria_get_replies']);
 assert.equal(JSON.parse(requests[1].options.body).p_choice,'yes');
 assert.equal(JSON.parse(requests[2].options.body).p_owner_secret,'a'.repeat(64));
});
test('service errors do not expose server response',async()=>{
 const client=createRsvpClient('https://example.supabase.co','key',async()=>({ok:false,status:429}));
 await assert.rejects(client.reply('2a861e9d-8752-47b7-bb61-86df31742a39','b'.repeat(64),'yes'),/429/);
});
