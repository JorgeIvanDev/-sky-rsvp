// CNIDARIA motion calibration regression checks.
// Run: node tests/motion-regression.js
// Synthetic traces exercise the current thresholds; browser device testing is still required.
const assert=require('node:assert/strict');
function replay(samples){
 let state='armed',launch=-Infinity,low=null,flightStart=0,freefall=0,last=0,impactStart=0,impactCount=0,firstFeet=0,stable=0,peakSpin=0;
 for(const {ms,m,spin=0} of samples){
  if(state==='armed'){
   if(m>13&&m<65)launch=ms;
   if(m<2.5&&ms-launch<450){
    if(low===null)low=ms;
    if(ms-low>=100){state='flying';flightStart=low;last=ms;}
   }else low=null;
   continue;
  }
  if(ms-last>250)return {ok:false,reason:'sensor gap'};
  if(m<2.5){freefall+=Math.min(ms-last,50);peakSpin=Math.max(peakSpin,spin)}
  last=ms;
  const seconds=(ms-flightStart)/1000,feet=9.80665*seconds*seconds/8*3.28084;
  if(impactStart&&m>=7&&m<=13&&ms-impactStart<=220){
   stable++;
   if(stable>=3&&freefall>=250)return {ok:true,mode:'gentle',feet:firstFeet,peakSpin};
  }else stable=0;
  if(seconds>.35&&seconds<=8&&m>16){
   if(freefall<250)return {ok:false,reason:'premature impact'};
   if(!impactStart){impactStart=ms;firstFeet=feet}
   impactCount++;
  }else if(!impactStart||ms-impactStart>220||m<2.5){impactStart=0;impactCount=0;firstFeet=0;stable=0}
  if(impactCount>=2&&ms-impactStart>=12&&freefall>=250)return {ok:true,mode:'strong',feet:firstFeet,peakSpin};
 }
 return {ok:false,reason:'no catch'};
}
const seq=(start,end,step,m,spin=100)=>Array.from({length:Math.floor((end-start)/step)+1},(_,i)=>({ms:start+i*step,m,spin}));
const flight=[{ms:0,m:30},...seq(50,180,16,.5),...seq(196,850,16,.3)];
const strong=replay([...flight,{ms:866,m:17.84,spin:1074},{ms:882,m:160.2,spin:1307}]);
assert.equal(strong.ok,true);assert.equal(strong.mode,'strong');assert.equal(strong.peakSpin,100,'impact spin must not count');
const gentle=replay([...flight,{ms:866,m:18},{ms:882,m:9.8},{ms:898,m:9.7},{ms:914,m:9.9}]);
assert.equal(gentle.ok,true);assert.equal(gentle.mode,'gentle');
const interrupted=replay([...flight,{ms:866,m:18},{ms:882,m:9.8},{ms:898,m:4},{ms:914,m:9.8},{ms:930,m:9.8}]);
assert.equal(interrupted.ok,false,'stable samples must be consecutive');
const noLaunch=replay([...seq(0,900,16,.3),{ms:916,m:22},{ms:932,m:30}]);
assert.equal(noLaunch.ok,false,'low gravity without launch is not a flight');
const gap=replay([...flight.slice(0,12),{ms:600,m:0.4}]);
assert.equal(gap.ok,false);
console.log('PASS: strong catch, gentle catch, interrupted settle, missing launch, sensor gap, spin isolation');
