import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wordBank,wordPools,requestedWords,dealWordDecks} from '../lib/words.ts';
import {act,view,advance} from '../lib/game.ts';
test('expanded library retains every requested phrase and produces safe, unique short prompts',()=>{
 assert.ok(wordBank.length>6000);
 requestedWords.forEach(word=>assert.ok(wordBank.includes(word),word));
 assert.equal(wordBank.length,new Set(wordBank).size);
 assert.ok(wordBank.every(word=>word.length>0&&word.length<=80));
});
test('all twelve players have distinct offers and every batch mixes three categories',()=>{
 const {decks,history}=dealWordDecks(12);
 assert.equal(decks.length,12);assert.equal(new Set(decks.flat()).size,144);
 decks.forEach(deck=>{assert.equal(deck.length,12);for(let i=0;i<12;i+=3){const batch=deck.slice(i,i+3);assert.equal(batch.filter(word=>wordPools[0].includes(word)).length,1);assert.equal(batch.filter(word=>wordPools.slice(1).some(pool=>pool.includes(word))).length,2)}});
 const next=dealWordDecks(12,history);assert.ok(next.decks.flat().every(word=>!history.includes(word)));
});
test('many games rotate exhausted categories without duplicating a current offer or growing history forever',()=>{
 let history=[];
 for(let i=0;i<60;i++){const next=dealWordDecks(12,history);assert.equal(new Set(next.decks.flat()).size,144);assert.ok(next.history.length<=1600);assert.equal(new Set(next.history).size,next.history.length);history=next.history}
});
test('room restart retains word history privately and the next game avoids the prior offers',()=>{
 const r={code:'ABCDEF',host:'a',players:['a','b','c'].map(id=>({id,name:id,secret:id})),phase:'lobby',game:'',round:0,duration:60,deadline:0,entries:[]};
 act(r,'a',{action:'start',duration:60},0);const original=[...r.wordHistory];
 advance(r,60000);advance(r,120000);advance(r,180000);
 act(r,'a',{action:'restart'},view(r,'a',0).replaySchedule.endsAt);
 assert.deepEqual(r.wordHistory,original);act(r,'a',{action:'start',duration:60},1000000);
 assert.ok(Object.values(r.prompts).flatMap(p=>p.deck).every(word=>!original.includes(word)));
 assert.equal(view(r,'a',0).wordHistory,undefined);
});
