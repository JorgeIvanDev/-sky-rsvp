#!/usr/bin/env node
// Production mobile-browser acceptance: real GitHub Pages host UI + Supabase RSVP.
// Creates clearly labelled disposable QA invitations; never logs host capabilities.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
if (process.env.CNIDARIA_SMOKE_CONFIRM !== 'YES') throw Error('Explicit production QA opt-in required');
const API='https://hwkxuczipnaqzhbnaurw.supabase.co/functions/v1/cnidaria-rsvp';
const PAGE='https://jorgeivandev.github.io/-sky-rsvp/host-live.html';
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const marker=randomUUID().slice(0,8);
 const api=async(action,extra={})=>{
   const r=await context.request.post(API,{data:{action,...extra},headers:{Origin:'https://jorgeivandev.github.io'}});
   return {status:r.status(),body:await r.json()};
 };
 const created=await api('create',{title:'[CNIDARIA MOBILE QA] '+marker});
 assert.equal(created.status,200,'create');
 const {inviteId,hostSecret}=created.body;
 assert.match(inviteId,/^[0-9a-f-]{36}$/i);
 assert.match(hostSecret,/^[0-9a-f-]{72}$/i);
 for(const choice of ['yes','maybe','no']){
   const result=await api('reply',{inviteId,name:'Mobile QA '+marker+' '+choice,choice});
   assert.equal(result.status,200,choice+' submit');
   assert.equal(result.body.saved,true);
 }
 const unauthorized=await api('inbox',{inviteId,hostSecret:randomUUID()+randomUUID()});
 assert.equal(unauthorized.status,401,'wrong secret');
 assert.ok(!unauthorized.body.replies,'no private data in denied response');
 await page.goto(PAGE+'#host='+inviteId+'.'+hostSecret,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#replies li').length===3,{timeout:20000});
 for(const choice of ['yes','maybe','no']){
   assert.equal(await page.locator('#replies li').filter({hasText:'Mobile QA '+marker+' '+choice}).count(),1,'mobile inbox '+choice);
 }
 assert.equal(await page.locator('.stat').count(),3,'three summary cards');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow on mobile');
 assert.equal(errors.length,0,'browser JavaScript errors: '+errors.join('; '));
 await page.getByRole('button',{name:'Lock'}).click();
 assert.equal(await page.locator('#replies li').count(),0,'lock clears private guest names');
 console.log('PASS: real mobile Chromium loaded deployed private host dashboard, displayed three named RSVP choices, rejected outsider, and cleared on lock.');
} finally {await browser.close()}
