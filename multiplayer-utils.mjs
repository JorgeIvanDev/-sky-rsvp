/** Shared pure helpers for CNIDARIA multiplayer. */
export const validInvite=token=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(token);
export function meetingAction(status,deadline,now=Date.now()){
  if(status==='completed')return 'completed';
  if(status==='cancelled'||status==='expired')return 'closed';
  if(new Date(deadline).getTime()<=now)return 'expired';
  return status==='accepted'?'checkin':'waiting';
}
export function formatLobby({meeting_status,participant_count,checked_in_count,meeting_deadline}){
  const count=Number(participant_count)||0,checked=Number(checked_in_count)||0;
  return 'Lobby · '+count+'/2 participants · '+checked+'/2 checked in · '+meeting_status+' · deadline '+new Date(meeting_deadline).toLocaleString();
}
