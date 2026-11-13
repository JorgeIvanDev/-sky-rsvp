// Natas read-only game tools. Pass ONLY authenticated, server-authorized data.
// This module never fetches data, trusts wallet addresses, or changes state.
const authorizedSnapshots=new WeakSet();
export function buildPlayerSnapshot(session, gameData) {
  if (!session || session.authenticated!==true || typeof session.playerId!=="string" || !session.playerId) {
    throw new Error("Authenticated player session required");
  }
  if (!gameData || gameData.playerId!==session.playerId) throw new Error("Player context mismatch");
  const best=gameData.personalBest;
  if (best!==null && best!==undefined && (!Number.isFinite(best)||best<0)) throw new Error("Invalid personal best");
  const rank=gameData.globalRank;
  if (rank!==null && rank!==undefined && (!Number.isSafeInteger(rank)||rank<1)) throw new Error("Invalid rank");
  const snapshot=Object.freeze({
    playerId:session.playerId,
    nickname:typeof gameData.nickname==="string"?gameData.nickname.slice(0,40):"Player",
    personalBest:best??null,
    globalRank:rank??null,
    rivalAhead:gameData.rivalAhead&&typeof gameData.rivalAhead.nickname==="string"&&Number.isFinite(gameData.rivalAhead.score)?
      Object.freeze({nickname:gameData.rivalAhead.nickname.slice(0,40),score:gameData.rivalAhead.score}):null,
    pendingChallenges:Number.isSafeInteger(gameData.pendingChallenges)&&gameData.pendingChallenges>=0?gameData.pendingChallenges:0
  });
  authorizedSnapshots.add(snapshot);
  return snapshot;
}
export function respondToPlayerQuestion(question,snapshot) {
  if (!snapshot || typeof snapshot!=="object" || !authorizedSnapshots.has(snapshot)) throw new Error("Authorized player snapshot required");
  const q=String(question??"").slice(0,500);
  if (/seed phrase|private key|recovery phrase|mnemonic|password/i.test(q)) return {reply:"Nope. Never share your wallet secrets with me or anybody.",actions:[]};
  if (/send|transfer|withdraw|wager|bet|stake|sign transaction/i.test(q)) return {reply:"I can't move funds or make wagers. Any future wallet action needs your separate explicit approval.",actions:[]};
  if (/rank|ahead|leaderboard|hall of fame|best|score/i.test(q)) {
    const best=snapshot.personalBest===null?"You don't have a recorded personal best yet.":"Your recorded best is "+snapshot.personalBest+".";
    const rank=snapshot.globalRank===null?"No global rank is available.":"You're ranked #"+snapshot.globalRank+".";
    const rival=snapshot.rivalAhead?" Just ahead: "+snapshot.rivalAhead.nickname+" at "+snapshot.rivalAhead.score+".":"";
    return {reply:best+" "+rank+rival,actions:[]};
  }
  if (/challenge|rematch|friend/i.test(q)) return {reply:"You have "+snapshot.pendingChallenges+" pending challenge(s). I can help draft a challenge later, but won't send one without confirmation.",actions:[]};
  return {reply:"Hey "+snapshot.nickname+"! Ask me about your personal best, global rank, or pending challenges.",actions:[]};
}
