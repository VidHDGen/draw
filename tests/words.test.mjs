import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wordBank,wordPools,requestedWords,dealWordDecks} from '../lib/words.ts';
import {pictureWordPages} from '../lib/word-data.ts';
import {act,view,advance} from '../lib/game.ts';
test('picture-based library includes all six pages and thousands of distinct short prompts',()=>{
 assert.ok(wordBank.length>=3000);
 assert.deepEqual(pictureWordPages.map(page=>page.length),[40,40,40,40,40,40]);
 assert.equal(requestedWords.length,235);
 assert.equal(wordPools.flat().length,wordBank.length);
 assert.ok(!wordBank.includes('穿芭蕾舞裙的霸王龙'));
 assert.ok(!wordBank.includes('涂口红的猩猩'));
 assert.ok(wordPools.every(pool=>pool.length>=300));
 requestedWords.forEach(word=>assert.ok(wordBank.includes(word),word));
 assert.equal(wordBank.length,new Set(wordBank).size);
 assert.ok(wordBank.every(word=>word.length>0&&word.length<=12));
});
test('all twelve players have distinct offers and every batch mixes three categories',()=>{
 const {decks,history}=dealWordDecks(12);
 assert.equal(decks.length,12);assert.equal(new Set(decks.flat()).size,144);
 decks.forEach(deck=>{assert.equal(deck.length,12);for(let i=0;i<12;i+=3){const batch=deck.slice(i,i+3);assert.equal(new Set(batch.map(word=>wordPools.findIndex(pool=>pool.includes(word)))).size,3)}});
 const next=dealWordDecks(12,history);assert.ok(next.decks.flat().every(word=>!history.includes(word)));
});
test('many games rotate exhausted categories without duplicating a current offer or growing history forever',()=>{
 let history=['穿芭蕾舞裙的霸王龙','涂口红的猩猩'];
 for(let i=0;i<60;i++){const next=dealWordDecks(12,history);assert.equal(new Set(next.decks.flat()).size,144);assert.ok(next.history.length<=1600);assert.ok(next.history.every(word=>wordBank.includes(word)));assert.ok(next.decks.flat().every(word=>!history.includes(word)));assert.equal(new Set(next.history).size,next.history.length);history=next.history}
});
test('room restart retains word history privately and the next game avoids the prior offers',()=>{
 const r={code:'ABCDEF',host:'a',players:['a','b','c'].map(id=>({id,name:id,secret:id,ready:true})),phase:'lobby',game:'',round:0,duration:60,deadline:0,entries:[]};
 act(r,'a',{action:'start',duration:60},0);const original=[...r.wordHistory];
 advance(r,60000);advance(r,130000);advance(r,190000);
 const end=view(r,'a',0).replaySchedule.endsAt;for(const secret of ['a','b','c'])act(r,secret,{action:'return',game:r.game},end);for(const secret of ['b','c'])act(r,secret,{action:'ready',game:r.game,ready:true},end);
 assert.deepEqual(r.wordHistory,original);act(r,'a',{action:'start',duration:60},1000000);
 assert.ok(Object.values(r.prompts).flatMap(p=>p.deck).every(word=>!original.includes(word)));
 assert.equal(view(r,'a',0).wordHistory,undefined);
});


test('when every word has been seen, each category reuses its oldest eligible entries first',()=>{
 const history=[...wordBank],{decks}=dealWordDecks(12,history),chosen=new Set(decks.flat());
 for(const pool of wordPools){const picked=pool.filter(word=>chosen.has(word));assert.ok(picked.length>0);assert.deepEqual(picked,pool.slice(0,picked.length))}
});
