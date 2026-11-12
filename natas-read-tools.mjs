// Server-only Natas read adapter. The caller MUST authenticate the session.
// No client-supplied playerId, wallet address or membership is trusted.
const READ_TOOLS = new Set(["personal_best","global_rankings","group_rankings","challenges","invitations"]);
const PRIVATE = new Set(["personal_best","group_rankings","challenges","invitations"]);
export async function runNatasRead({session, tool, groupId, adapters, enabled=false}) {
  if (!enabled) return {ok:false,error:"feature_disabled"};
  if (!session || typeof session.playerId !== "string" || !session.playerId.trim()) return {ok:false,error:"unauthorized"};
  if (!READ_TOOLS.has(tool)) return {ok:false,error:"unsupported_tool"};
  if (groupId !== undefined && (typeof groupId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(groupId))) return {ok:false,error:"invalid_group"};
  if (tool === "group_rankings" && !groupId) return {ok:false,error:"group_required"};
  if (tool !== "group_rankings" && groupId !== undefined) return {ok:false,error:"unexpected_group"};
  if (!adapters || typeof adapters[tool] !== "function") return {ok:false,error:"unavailable"};
  if (PRIVATE.has(tool) && typeof adapters.authorize !== "function") return {ok:false,error:"unavailable"};
  try {
    if (PRIVATE.has(tool)) {
      const permitted = await adapters.authorize({playerId:session.playerId,tool,groupId});
      if (permitted !== true) return {ok:false,error:"forbidden"};
    }
    const data = await adapters[tool]({playerId:session.playerId,groupId});
    return {ok:true,data,verified:false};
  } catch {
    return {ok:false,error:"unavailable"};
  }
}
// Drafts only: never sends, transfers, or posts a challenge.
export function draftNatasChallenge({opponentId, message}) {
  if (typeof opponentId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(opponentId)) return {ok:false,error:"invalid_opponent"};
  if (typeof message !== "string" || message.length > 240 || /[\u0000-\u001f\u007f]/.test(message)) return {ok:false,error:"invalid_message"};
  return {ok:true,status:"draft_requires_confirmation",draft:{opponentId,message},sent:false};
}
