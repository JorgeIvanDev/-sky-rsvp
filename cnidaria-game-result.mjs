/** Shared, conservative result contract for CNIDARIA solo and Gauntlet modes.
 * A sensor-estimated flight is NOT proof of a hand catch.
 * This module never writes a score or trusts client results as authoritative.
 */
export function normalizeGameResult(outcome){
 if(!outcome||typeof outcome!=='object'||Array.isArray(outcome))return null;
 const feet=outcome.feet, spin=outcome.airborneSpin;
 if(!Number.isFinite(feet)||feet<0||feet>100||!Number.isFinite(spin)||spin<0||spin>100000)return null;
 const estimatedAirtimeMs=Math.round(Math.sqrt(feet/3.28084*8/9.80665)*1000);
 if(!Number.isSafeInteger(estimatedAirtimeMs)||estimatedAirtimeMs<0||estimatedAirtimeMs>15000)return null;
 const coverage=['not_started','no_samples','sensor_gap','timeout','insufficient_samples','observed_350ms','incomplete'].includes(outcome.postImpactCoverage)?outcome.postImpactCoverage:'unknown';
 return Object.freeze({version:1,estimatedHeightFeet:feet,estimatedAirtimeMs,peakSpinDegreesPerSecond:spin,catchLike:outcome.catchDetected===true,handCatchVerified:false,postImpactCoverage:coverage,eligibleForBetaReview:outcome.catchDetected===true&&coverage==='observed_350ms'&&estimatedAirtimeMs>=100,source:'cnidaria-original-engine'});
}
