import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyNatasIntent,answerNatas} from './natas-agent-core.mjs';
const cases=[
 ['es','¿Cómo jugar?','game_help','Sigue las instrucciones'],
 ['pt','Como jogar?','game_help','Siga as instruções'],
 ['es','¿Cuál es mi puntuación?','rankings','Salón de la Fama'],
 ['pt','qual é meu ranking?','rankings','Hall da Fama'],
 ['es','Quiero una revancha','challenges','revancha'],
 ['pt','quero um desafio','challenges','revanche'],
 ['es','mi invitación','invitations','invitaciones'],
 ['pt','meu convite','invitations','Convites'],
 ['es','mi billetera','wallet_help','billetera'],
 ['pt','minha carteira','wallet_help','carteira'],
 ['en','how to play','game_help','Follow the game'],
 ['es','hola','help','Soy Natas'],
 ['pt','olá','help','Sou Natas']
];
for(const [language,input,intent,fragment] of cases){
 test(language+' '+input,()=>{
  assert.equal(classifyNatasIntent(input).type,intent);
  const result=answerNatas(input,{language});
  assert.equal(result.intent,intent);
  assert.ok(result.reply.includes(fragment),result.reply);
  assert.deepEqual(result.actions,[]);
 });
}
test('unknown language falls back to English without side effects',()=>{
 const result=answerNatas('how to play',{language:'fr-CA'});
 assert.equal(result.intent,'game_help');
 assert.ok(result.reply.startsWith('Follow the game'));
 assert.deepEqual(result.actions,[]);
});
