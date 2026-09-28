import {test} from 'node:test';
import assert from 'node:assert/strict';
import {act,advance,view} from '../lib/game.ts';

function room(){return {code:'ABCDEF',host:'a',players:[{id:'a',name:'甲',secret:'s1'},{id:'b',name:'乙',secret:'s2'},{id:'c',name:'丙',secret:'s3'}],phase:'lobby',game:'',round:0,duration:60,deadline:0,entries:[]}}
test('timeout fills missing answers, rotates once, and starts a fresh deadline',()=>{const r=room();act(r,'s1',{action:'start',duration:60},1000);act(r,'s1',{action:'submit',game:r.game,round:0,text:r.prompts.a.deck[0]},1100);assert.equal(advance(r,60999),false);assert.equal(advance(r,61000),true);assert.equal(r.round,1);assert.equal(r.deadline,121000);assert.equal(r.entries[0][1]?.skipped,true);assert.equal(view(r,'s2',1).previous?.text,r.prompts.a.deck[0]);assert.equal(advance(r,61000),false)});
test('stale game and client forged round are rejected',()=>{const r=room();act(r,'s1',{action:'start',duration:60});assert.throws(()=>act(r,'s1',{action:'submit',game:'stale',round:0,text:'bad'}));assert.throws(()=>act(r,'s2',{action:'submit',game:r.game,round:2,text:'bad'}));assert.equal(r.entries[0].filter(Boolean).length,0)});
test('leaving preserves game rotation and fills the departed player on each round',()=>{const r=room();act(r,'s1',{action:'start',duration:60},0);act(r,'s1',{action:'leave'},1);assert.equal(r.players.length,3);assert.equal(r.host,'b');assert.equal(r.entries[0][0]?.skipped,true);advance(r,60000);advance(r,60001);assert.equal(r.entries[1][0]?.skipped,true)});
test('room cap, unique nicknames and host permissions are enforced',()=>{const r=room();assert.throws(()=>act(r,'s2',{action:'start',duration:60}));assert.throws(()=>act(r,'new',{action:'join',name:'甲'}));for(let i=0;i<9;i++)act(r,'new'+i,{action:'join',name:'玩家'+i});assert.equal(r.players.length,12);assert.throws(()=>act(r,'overflow',{action:'join',name:'第十三人'}));assert.throws(()=>view(r,'outsider',0));assert.equal(view(r,'s1',0).albums,null)});


test('each player has three private choices and exactly three persistent rerolls',()=>{
 const r=room();act(r,'s1',{action:'start',duration:60});
 const first=view(r,'s1',0);assert.equal(first.choices.length,3);assert.equal(first.rerollsLeft,3);assert.ok(!JSON.stringify(first).includes('deck'));assert.equal(first.prompts,undefined);
 const seen=new Set(first.choices);
 for(let batch=0;batch<3;batch++){
  act(r,'s1',{action:'reroll',game:r.game,choiceSet:batch});
  const state=view(JSON.parse(JSON.stringify(r)),'s1',1);assert.equal(state.rerollsLeft,2-batch);
  state.choices.forEach(word=>{assert.ok(!seen.has(word));seen.add(word)});
  assert.throws(()=>act(r,'s1',{action:'reroll',game:r.game,choiceSet:batch}));
 }
 assert.throws(()=>act(r,'s1',{action:'reroll',game:r.game,choiceSet:3}));
 assert.equal(view(r,'s2',1).rerollsLeft,3);
 assert.throws(()=>act(r,'s1',{action:'submit',game:r.game,round:0,text:first.choices[0]}));
 const choice=view(r,'s1',1).choices[0];act(r,'s1',{action:'submit',game:r.game,round:0,text:choice});
 assert.throws(()=>act(r,'s1',{action:'reroll',game:r.game,choiceSet:3}));
 assert.equal(r.entries[0][0].text,choice);
});
