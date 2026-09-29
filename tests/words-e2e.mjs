import assert from 'node:assert/strict';
import {wordBank,wordPools} from '../lib/words.ts';
const base=process.env.TEST_BASE_URL||'http://localhost:5173';
const tokens=Array.from({length:3},()=>crypto.randomUUID()+crypto.randomUUID());let code;
async function post(i,action,extra={}){const response=await fetch(base+'/api/room',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens[i]},body:JSON.stringify({code,action,...extra}),signal:AbortSignal.timeout(30000)});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data}
const created=await post(0,'create',{name:'词库验证员'});code=created.code;
await Promise.all([post(1,'join',{name:'词库测试甲'}),post(2,'join',{name:'词库测试乙'})]);
await Promise.all([post(1,'ready',{game:'',ready:true}),post(2,'ready',{game:'',ready:true})]);
const start=await post(0,'start',{duration:180}),seen=new Set(),prefetched=new Map();
async function get(i){const r=await fetch(base+'/api/room?code='+code,{headers:{Authorization:'Bearer '+tokens[i]},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);return r.json()}
for(let batch=0;batch<4;batch++){
 const offers=await Promise.all(tokens.map((_,i)=>batch===0?get(i):post(i,'reroll',{game:start.game,choiceSet:batch-1})));
 for(const offer of offers){if(batch>0)assert.deepEqual(offer.choices,prefetched.get(offer.me));if(batch<3)assert.equal(offer.nextChoices.length,3);else assert.equal(offer.nextChoices,null);prefetched.set(offer.me,offer.nextChoices);assert.equal(offer.choices.length,3);assert.equal(offer.rerollsLeft,3-batch);assert.equal(offer.wordHistory,undefined);assert.equal(offer.choices.filter(word=>wordPools[0].includes(word)).length,1);for(const word of offer.choices){assert.ok(wordBank.includes(word),word);assert.ok(!seen.has(word),word);seen.add(word)}}
}
assert.equal(seen.size,36);assert.equal((await get(0)).rerollsLeft,0);
await Promise.all(tokens.map((_,i)=>post(i,'leave')));
console.log('PASS: production serves expanded mixed-category prompts, 36 distinct offers across three players, rerolls persist, private history is hidden.');
