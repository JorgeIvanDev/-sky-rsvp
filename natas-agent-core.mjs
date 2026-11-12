/* NATAS agent core: safe, dependency-free, read-only MVP.
   Never accepts seed phrases, private keys, transaction signing or funds transfer.
   Caller supplies server-authorized player context; client-side context is NOT authentication. */
export function classifyNatasIntent(input) {
  const text=String(input??"").trim().slice(0,500);
  if (!text) return {type:"help"};
  if (/seed phrase|private key|recovery phrase|mnemonic|password/i.test(text)) return {type:"secret_refusal"};
  if (/send|transfer|withdraw|stake|bet|wager|pay|sign transaction/i.test(text)) return {type:"transaction_refusal"};
  if (/wallet|log.?in|sign.?in|identity|address/i.test(text)) return {type:"wallet_help"};
  if (/rank|leaderboard|hall of fame|personal best|score/i.test(text)) return {type:"rankings"};
  if (/challenge|rematch|friend|opponent/i.test(text)) return {type:"challenges"};
  if (/invite|rsvp|event|turkey hall/i.test(text)) return {type:"invitations"};
  if (/how|play|toss|catch|rules/i.test(text)) return {type:"game_help"};
  return {type:"help"};
}
export function answerNatas(input, context={}) {
  const intent=classifyNatasIntent(input).type;
  const name=typeof context.nickname==="string" ? context.nickname.slice(0,40) : "";
  const hello=name ? "Hey, "+name+". " : "";
  const answers={
    secret_refusal:"Whoa. Never give me your seed phrase, private key, or password. Not even if I ask. Which I won't.",
    transaction_refusal:"I can't move money or place wagers. Wallet actions would need a separate secure flow and your explicit approval.",
    wallet_help:"Your wallet can help prove your identity by signing a one-time login message. Never share your seed phrase. Wallet login isn't connected to this demo yet.",
    rankings: context.personalBest != null ? hello+"Your reported personal best is "+String(context.personalBest)+" (from the supplied game context). I can't verify live rankings in this demo." : "The Hall of Fame tracks qualifying personal bests. I can't read your live rank yet.",
    challenges:"Want a rematch? I'm emotionally prepared. Actual challenge creation will need the game's authenticated API.",
    invitations:"Invitations and RSVP are part of the game, but I won't change an RSVP without asking. This demo can't read or modify live invitations.",
    game_help:"Follow the game's instructions, keep the area clear, and never throw toward people, animals, or breakable objects. The motion sensor can't guarantee a safe catch.",
    help:"I'm Natas. Like nautical. Ask me about the Hall of Fame, wallet sign-in, challenges, invitations, or how to play."
  };
  return {intent,reply:answers[intent],actions:[]};
}
