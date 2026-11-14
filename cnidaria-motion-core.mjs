/** CNIDARIA's existing threshold-based toss replay, extracted from tests/motion-regression.js.
 * Browser-safe and deterministic. A positive result is catch-like motion, NOT proof of a hand catch.
 */
export function replay(samples){
 // Validate the complete trace before scoring; an early catch-like event must not mask corrupted trailing samples.
 if(!Array.isArray(samples))return {ok:false,reason:'invalid sensor sample'};
 let checkedMs=-Infinity;
 for(const sample of samples){
  if(!sample||typeof sample!=='object')return {ok:false,reason:'invalid sensor sample'};
  const {ms,m,spin=0}=sample;
  if(!Number.isFinite(ms)||!Number.isFinite(m)||m<0||!Number.isFinite(spin)||ms<0||ms<=checkedMs)return {ok:false,reason:'invalid sensor sample'};
  checkedMs=ms;
 }
 let previousMs=-Infinity,previousLowMs=-Infinity;let state='armed',launch=-Infinity,low=null,flightStart=0,freefall=0,last=0,impactStart=0,impactCount=0,firstFeet=0,strongFirstFeet=0,strongAt=0,stable=0,peakSpin=0;
 for(const {ms,m,spin=0} of samples){
  // A discontinuous or malformed sensor stream cannot establish a catch-like event.
  if(!Number.isFinite(ms)||!Number.isFinite(m)||m<0||!Number.isFinite(spin)||ms<0||ms<=previousMs)return {ok:false,reason:'invalid sensor sample'};
  // Never stitch an armed low-g launch window across a sensor interruption.
  // Flight has its own gap rejection below; this protects the pre-flight transition.
  if(state==='armed'&&previousMs!==-Infinity&&ms-previousMs>250){launch=-Infinity;low=null;}
  previousMs=ms;
  if(state==='armed'){
   if(m>13&&m<65)launch=ms;
   if(m<2.5&&ms-launch<450){
    // Require continuous low-g evidence; a sparse sensor stream cannot invent a launch.
    if(low===null||ms-previousLowMs>50)low=ms;
    if(ms-low>=100){state='flying';flightStart=low;last=ms;}
   }else low=null;
   previousLowMs=ms;
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

/** Collect timestamped acceleration magnitudes without making claims about physical flight. */
/** Conservative post-impact review for live scoring. A replay hit is only a candidate:
 * subsequent bounces, renewed freefall, or missing 350ms observation invalidate it.
 * This cannot establish that a human hand caught the phone.
 */
export function replayObserved(samples,{observationMs=350,maxGapMs=100,minPostSamples=8}={}){
 if(!Number.isFinite(observationMs)||observationMs<350||!Number.isFinite(maxGapMs)||maxGapMs<=0||!Number.isInteger(minPostSamples)||minPostSamples<8)return {ok:false,reason:'invalid observation settings'};
 const candidate=replay(samples);
 if(!candidate.ok)return candidate;
 // Locate the first impact after a sustained low-g flight, not the highest later spike.
 let lowStart=null,flight=false,flightAt=null,impactAt=null;
 for(const s of samples){
  if(s.m<2.5){if(lowStart===null)lowStart=s.ms;if(s.ms-lowStart>=100){if(!flight)flightAt=lowStart;flight=true;}}
  else if(!flight)lowStart=null;
  if(flight&&s.m>16){impactAt=s.ms;break;}
 }
 if(impactAt===null)return {ok:false,reason:'no impact to observe'};
 // Do not score a flight reconstructed through missing pre-impact sensor data.
 const flightSamples=samples.filter(s=>s.ms>=flightAt&&s.ms<=impactAt);
 for(let i=1;i<flightSamples.length;i++)if(flightSamples[i].ms-flightSamples[i-1].ms>maxGapMs)return {ok:false,reason:'pre-impact sensor gap'};
 // Include the first sample on/after the deadline: real sensors rarely land exactly at 350ms.
 const endIndex=samples.findIndex(s=>s.ms>=impactAt+observationMs);
 if(endIndex<0)return {ok:false,reason:'incomplete post-impact observation'};
 const post=samples.slice(samples.findIndex(s=>s.ms>=impactAt),endIndex+1);
 for(let i=1;i<post.length;i++)if(post[i].ms-post[i-1].ms>maxGapMs)return {ok:false,reason:'post-impact sensor gap'};
 // A few widely spaced frames cannot establish a settled catch-like trajectory.
 if(post.length<minPostSamples)return {ok:false,reason:'insufficient post-impact samples'};
 // A second high-g cluster following a pause or low-g interval is a bounce, not a stable catch.
 let quiet=false,lowRun=0,lastMs=impactAt,lastHighMs=impactAt,previousLow=false;
 for(const s of post.slice(1)){
  if(s.m<2.5)lowRun=previousLow&&s.ms-lastMs<=50?lowRun+(s.ms-lastMs):0;else lowRun=0;
  previousLow=s.m<2.5;
  if(lowRun>=48)quiet=true;
  if(s.m>16&&s.ms-lastHighMs>80)return {ok:false,reason:'separated post-impact spike'};
  if(quiet&&s.m>16)return {ok:false,reason:'re-impact after freefall'};
  if(s.m>16)lastHighMs=s.ms;
  lastMs=s.ms;
 }
 if(quiet)return {ok:false,reason:'renewed low-g after impact'};
 return {...candidate,observationMs,classification:'catch-like only'};
}

export function createMotionTrace({maxSamples=1500}={}){
  if(!Number.isInteger(maxSamples)||maxSamples<1||maxSamples>100000)throw Error('Invalid motion trace capacity');
  const samples=[];let first=null;
  return {samples,add(sample){
    if(!sample||typeof sample!=='object')return false;
    const {timestamp,magnitude,spin=0}=sample;
    if(!Number.isFinite(timestamp)||!Number.isFinite(magnitude)||magnitude<0||!Number.isFinite(spin))return false;
    if(first===null)first=timestamp;
    const ms=Math.round(timestamp-first);
    if(samples.length>=maxSamples||ms<0||(samples.length&&ms<=samples[samples.length-1].ms))return false;
    samples.push({ms,m:magnitude,spin});return true;
  },evaluate(){return replayObserved(samples)},reset(){samples.length=0;first=null}};
}
