/* NATAS agent core: safe, dependency-free, read-only MVP.
   Never accepts seed phrases, private keys, transaction signing or funds transfer.
   Caller supplies server-authorized player context; client-side context is NOT authentication. */
export function classifyNatasIntent(input) {
  const text=String(input??"").trim().slice(0,500);
  if (!text) return {type:"help"};
  if (/seed[\s-]*phrase|private[\s-]*key|recovery[\s-]*phrase|mnemonic|password|contrase(?:ñ|n)a|senha|frase[\s-]*(?:semilla|de[\s-]*recupera(?:ción|cao|ção)?)|chave[\s-]*privada|clave[\s-]*privada/i.test(text)) return {type:"secret_refusal"};
  // Asking to share a challenge does not authorize money movement or actual delivery.
  if (/(?:send|share|enviar|mandar|compartir|compartilhar)\s+(?:(?:a|my|um|un|o|el)\s+)?(?:challenge|desaf[ií]o|reto|desafio)\b/i.test(text) && !/\b(?:sats?|bsv|bitcoin|money|dinero|dinheiro|funds?|wallet|carteira|billetera|pagar|pay|bet|wager|aposta|apostar|transfer|withdraw|retirar)\b/i.test(text)) return {type:"challenges"};
  if (/send|transfer|withdraw|stake|bet|wager|pay|sign[\s-]*transaction|env[ií](?:a|ar|e|o)|mand(?:a|ar|e)\s+(?:dinero|sats|bitcoin|bsv)|transferir|retirar[\s-]*dinero|apostar|pagar|transfer[eê]ncia|saque|sacar[\s-]*dinero|enviar[\s-]*(?:dinero|sats)|enviar[\s-]*(?:bitcoin|bsv)/i.test(text)) return {type:"transaction_refusal"};
  if (/wallet|log.?in|sign.?in|identity|address|billetera|cartera|iniciar sesi[oó]n|identidad|carteira|entrar na conta/i.test(text)) return {type:"wallet_help"};
  if (/rank|leaderboard|hall of fame|personal best|score|clasificaci[oó]n|puntuaci[oó]n|r[aá]nking|puntaje|sal[oã]o da fama|pontua[cç][aã]o/i.test(text)) return {type:"rankings"};
  if (/challenge|rematch|friend|opponent|desaf[ií]o|reto|revancha|amigo|desafio|amigos/i.test(text)) return {type:"challenges"};
  if (/invit(?:e|ation|ations)|rsvp|events?|turkey hall|invitaci[oó]n|confirmar asistencia|evento|convite|presen[cç]a/i.test(text)) return {type:"invitations"};
  if (/how|play|toss|catch|rules|c[oó]mo jugar|jugar|lanzar|atrapar|reglas|como jogar|jogar|lan[cç]ar|pegar|regras/i.test(text)) return {type:"game_help"};
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
    invitations:"Invitations and RSVP are part of the game. Complete one challenge attempt to reveal an invitation and respond; winning is not required. This demo cannot read or change live RSVPs.",
    game_help:"Follow the game's instructions, keep the area clear, and never throw toward people, animals, or breakable objects. The motion sensor can't guarantee a safe catch.",
    help:"I'm Natas. Like nautical. Ask me about the Hall of Fame, wallet sign-in, challenges, invitations, or how to play."
  };
  const lang=String(context.language||'en').toLowerCase().split('-')[0];
  const localized={
    es:{
      secret_refusal:'¡Alto ahí! Nunca compartas tu frase semilla, clave privada ni contraseña. Ni siquiera conmigo.',
      transaction_refusal:'No puedo mover dinero ni hacer apuestas. Cualquier acción con tu billetera necesita un proceso seguro y tu autorización.',
      wallet_help:'Tu billetera puede verificar tu identidad firmando un mensaje de un solo uso. Nunca compartas tu frase semilla. Esta demo todavía no tiene inicio de sesión.',
      rankings:context.personalBest!=null?'Tu mejor marca registrada es '+String(context.personalBest)+'. No puedo verificar la clasificación en vivo desde esta demo.':'El Salón de la Fama muestra las mejores marcas. Todavía no puedo consultar tu puesto en vivo.',
      challenges:'¿Quieres revancha? Yo ya estoy listo. Para enviar retos reales hace falta conectar el servicio autenticado del juego.',
      invitations:'Las invitaciones y confirmaciones son parte del juego. Primero completas un intento del desafío; luego puedes ver la invitación y responder. Esta demo no puede modificar tus respuestas.',
      game_help:'Sigue las instrucciones, despeja el área y nunca lances el teléfono hacia personas, animales ni objetos frágiles. Los sensores no garantizan una atrapada segura.',
      help:'Soy Natas, el calamar del café. Pregúntame por el Salón de la Fama, la billetera, los desafíos, las invitaciones o cómo jugar.'
    },
    pt:{
      secret_refusal:'Opa! Nunca compartilhe sua frase de recuperação, chave privada ou senha. Nem comigo.',
      transaction_refusal:'Não posso transferir dinheiro nem fazer apostas. Ações na carteira exigem um processo seguro e sua autorização.',
      wallet_help:'Sua carteira pode comprovar sua identidade assinando uma mensagem única. Nunca compartilhe sua frase de recuperação. O login ainda não está conectado nesta demonstração.',
      rankings:context.personalBest!=null?'Seu melhor resultado informado é '+String(context.personalBest)+'. Não consigo verificar o ranking ao vivo nesta demonstração.':'O Hall da Fama registra os melhores resultados. Ainda não consigo consultar sua posição ao vivo.',
      challenges:'Quer revanche? Estou pronto. Para criar desafios reais, precisamos da API autenticada do jogo.',
      invitations:'Convites e confirmações fazem parte do jogo. Primeiro complete uma tentativa do desafio; depois veja o convite e responda. Esta demonstração não altera confirmações.',
      game_help:'Siga as instruções, libere o espaço e nunca lance o celular em direção a pessoas, animais ou objetos frágeis. Os sensores não garantem uma pegada segura.',
      help:'Sou Natas, a lula do café. Pergunte sobre o Hall da Fama, carteira, desafios, convites ou como jogar.'
    }
  };
  return {intent,reply:localized[lang]?.[intent]||answers[intent],actions:[]};
}
