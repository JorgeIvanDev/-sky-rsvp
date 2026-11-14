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
 let previousMs=-Infinity;let state='armed',launch=-Infinity,low=null,flightStart=0,freefall=0,last=0,impactStart=0,impactCount=0,firstFeet=0,strongFirstFeet=0,strongAt=0,stable=0,peakSpin=0;
 for(const {ms,m,spin=0} of samples){
  // A discontinuous or malformed sensor stream cannot establish a catch-like event.
  if(!Number.isFinite(ms)||!Number.isFinite(m)||m<0||!Number.isFinite(spin)||ms<0||ms<=previousMs)return {ok:false,reason:'invalid sensor sample'};
  previousMs=ms;
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

/** Collect timestamped acceleration magnitudes without making claims about physical flight. */
export function createMotionTrace({maxSamples=1500}={}){
  const samples=[];let first=null;
  return {samples,add({timestamp,magnitude,spin=0}){
    if(!Number.isFinite(timestamp)||!Number.isFinite(magnitude)||magnitude<0)return false;
    if(first===null)first=timestamp;
    const ms=Math.round(timestamp-first);
    if(samples.length>=maxSamples||ms<0||(samples.length&&ms<=samples[samples.length-1].ms))return false;
    samples.push({ms,m:magnitude,spin:Number.isFinite(spin)?spin:0});return true;
  },evaluate(){return replay(samples)},reset(){samples.length=0;first=null}};
}
