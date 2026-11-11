// CNIDARIA motion calibration regression checks.
// Run: node tests/motion-regression.js
// Synthetic traces exercise the current thresholds; browser device testing is still required.
const assert=require('node:assert/strict');
function replay(samples){
 let state='armed',launch=-Infinity,low=null,flightStart=0,freefall=0,last=0,impactStart=0,impactCount=0,firstFeet=0,strongFirstFeet=0,strongAt=0,stable=0,peakSpin=0;
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
   if(impactCount===0){strongAt=ms;strongFirstFeet=feet}
   impactCount++;
  }else{impactCount=0;strongAt=0;strongFirstFeet=0;if(!impactStart||ms-impactStart>220||m<2.5){impactStart=0;firstFeet=0;stable=0}}
  if(impactCount>=2&&ms-strongAt>=12&&freefall>=250)return {ok:true,mode:'strong',feet:strongFirstFeet,peakSpin};
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
const separatedImpacts=replay([...flight,{ms:866,m:18},{ms:882,m:5},{ms:898,m:19}]);
assert.equal(separatedImpacts.ok,false,'separated spikes must not count as consecutive impacts');
// A second high spike after a stable-looking interruption must not be a strong catch.
const stableThenSpike=replay([...flight,{ms:866,m:18},{ms:882,m:9.8},{ms:898,m:19}]);
assert.equal(stableThenSpike.ok,false,'non-consecutive impact spikes cannot qualify');
const stableSoftWithNoise=replay([...flight,{ms:866,m:18},{ms:882,m:9.8},{ms:898,m:9.9},{ms:914,m:5},{ms:930,m:9.8},{ms:946,m:9.9}]);
assert.equal(stableSoftWithNoise.ok,false,'gentle confirmation requires three uninterrupted samples');
const noLaunch=replay([...seq(0,900,16,.3),{ms:916,m:22},{ms:932,m:30}]);
assert.equal(noLaunch.ok,false,'low gravity without launch is not a flight');
const gap=replay([...flight.slice(0,12),{ms:600,m:0.4}]);
assert.equal(gap.ok,false);
// Confirmed real-world soft, two-handed catch (2026-11-11, ~4.9 ft).
// Values are sampled from the shared recording; no identity/location stored.
const confirmedSoft=[
 {ms:6085,m:47.7,spin:359},{ms:6102,m:43.54,spin:360},{ms:6118,m:37.88,spin:322.2},
 {ms:6135,m:25.24,spin:205.3},{ms:6152,m:10.12,spin:153},
 ...seq(6168,7251,16,0.4,132),
 {ms:7268,m:19.35,spin:711.5},{ms:7285,m:34.42,spin:1164}
];
const recorded=replay(confirmedSoft);
assert.equal(recorded.ok,true,'confirmed real-world soft catch should qualify');
assert.equal(recorded.mode,'strong','two impact samples should use strong path');
assert.ok(recorded.feet>4.7&&recorded.feet<5.1,'recorded flight should estimate near 4.9 ft');
assert.equal(recorded.peakSpin,132,'impact rotation must not be counted');
console.log('PASS: strong catch, gentle catch, interrupted settle, separated impacts, noisy gentle catch, missing launch, sensor gap, recorded soft catch, spin isolation');
