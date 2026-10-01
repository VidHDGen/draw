import {test} from 'node:test';
import assert from 'node:assert/strict';
import {act,advance,view} from '../lib/game.ts';
function room(){return {code:'ABCDEF',host:'a',players:['a','b','c'].map(id=>({id,name:'玩家'+id,secret:id})),phase:'lobby',game:'',round:0,duration:60,deadline:0,entries:[]}}
function ready(r,id,value=true){act(r,id,{action:'ready',game:r.game,ready:value})}
function start(r){ready(r,'b');ready(r,'c');act(r,'a',{action:'start',duration:60},0)}
function finish(r){start(r);advance(r,60000);advance(r,130000);advance(r,190000);return view(r,'a',0).replaySchedule.endsAt}
test('host must wait for all other players; readiness is explicit, private to the player, and cleared each game',()=>{
 const r=room();assert.equal(view(r,'a',0).canStart,false);
 assert.throws(()=>act(r,'a',{action:'start',duration:60}),e=>e.status===409);
 ready(r,'b');ready(r,'c');assert.equal(view(r,'a',0).canStart,true);
 ready(r,'b',false);assert.equal(view(r,'a',0).canStart,false);
 assert.throws(()=>act(r,'a',{action:'ready',game:'',ready:true}));
 assert.throws(()=>act(r,'b',{action:'ready',game:'stale',ready:true}));
 ready(r,'b');act(r,'a',{action:'start',duration:60});assert.ok(r.players.every(p=>!p.ready&&!p.returned));
 assert.throws(()=>ready(r,'b'));assert.throws(()=>act(r,'b',{action:'start',duration:60}),e=>e.status===403);
});
test('each player returns independently after the shared replay; returns and polling preserve readiness',()=>{
 const r=room(),end=finish(r),game=r.game,plan=view(r,'a',0).replaySchedule;
 assert.throws(()=>act(r,'b',{action:'return',game},end-1),e=>e.status===409);
 act(r,'b',{action:'return',game},end);assert.equal(view(r,'b',1).phase,'lobby');assert.equal(view(r,'a',1).phase,'reveal');assert.deepEqual(view(r,'a',1).replaySchedule,plan);
 ready(r,'b');act(r,'b',{action:'return',game},end);assert.equal(r.players.find(p=>p.id==='b').ready,true);
 act(r,'a',{action:'return',game},end);assert.throws(()=>act(r,'a',{action:'start',duration:60},end),e=>e.status===409);
 assert.equal(view(r,'a',2).players.find(p=>p.id==='c').returned,false);
 act(r,'c',{action:'return',game},end);assert.equal(r.phase,'lobby');assert.equal(r.players.find(p=>p.id==='b').ready,true);assert.equal(view(r,'a',3).canStart,false);
 ready(r,'c');assert.equal(view(JSON.parse(JSON.stringify(r)),'a',3).canStart,true);
 act(r,'a',{action:'start',duration:60},end);assert.throws(()=>act(r,'b',{action:'return',game},end));assert.throws(()=>act(r,'b',{action:'ready',game,ready:true},end));
});
test('only the host can kick, kicked identities cannot rejoin or read, and removal is private',()=>{
 const r=room();assert.throws(()=>act(r,'b',{action:'kick',playerId:'c'}),e=>e.status===403);
 assert.throws(()=>act(r,'a',{action:'kick',playerId:'a'}));
 act(r,'a',{action:'kick',playerId:'b'});assert.equal(r.players.length,2);
 for(const action of ['join','ready','submit','return'])assert.throws(()=>act(r,'b',{action,name:'新名字',game:r.game,ready:true}),e=>e.code==='ROOM_KICKED');
 assert.throws(()=>view(r,'b',0),e=>e.code==='ROOM_KICKED');assert.equal(view(r,'a',0).removed,undefined);
 act(r,'d',{action:'join',name:'新朋友'});assert.equal(view(r,'a',1).canStart,false);
});
test('midgame kicks keep rotation, previous-player identity and existing drawings intact',()=>{
 const r=room();start(r);const word=r.prompts.b.deck[0];act(r,'b',{action:'submit',game:r.game,round:0,text:word},1);
 act(r,'a',{action:'kick',playerId:'b'},2);assert.equal(r.players.length,3);assert.equal(r.entries[0][1].text,word);
 advance(r,60000);const state=view(r,'c',1);assert.equal(state.previous.text,word);assert.deepEqual(state.previousPlayer,{id:'b',name:'玩家b',avatar:1});assert.equal(state.previousPlayer.secret,undefined);
 advance(r,60001);assert.equal(r.entries[1][1].skipped,true);
 advance(r,130000);advance(r,190000);const end=view(r,'a',2).replaySchedule.endsAt;
 act(r,'a',{action:'return',game:r.game},end);act(r,'c',{action:'return',game:r.game},end);assert.equal(r.players.length,2);assert.equal(r.phase,'lobby');
});
test('leaving or kicking the last player still in results releases the waiting lobby',()=>{
 for(const action of ['leave','kick']){const r=room(),end=finish(r);for(const id of ['a','b'])act(r,id,{action:'return',game:r.game},end);ready(r,'b');
  act(r,action==='kick'?'a':'c',{action,playerId:'c'},end);assert.equal(r.phase,'lobby');assert.equal(r.players.length,2);assert.equal(r.players.find(p=>p.id==='b').ready,true);
 }
});


test('next-game seats shuffle before readiness, remain stable on repeated returns, and preserve replay and avatars',()=>{
 const r=room(),end=finish(r),game=r.game,old=r.players.map(p=>p.id),plan=view(r,'a',0).replaySchedule;
 act(r,'b',{action:'return',game},end);const seats=view(r,'b',1).players.map(p=>p.id);
 assert.notDeepEqual(seats,old);assert.deepEqual([...seats].sort(),[...old].sort());
 assert.deepEqual(view(r,'a',1).replaySchedule,plan);assert.deepEqual(r.players.map(p=>p.id),old);
 ready(r,'b');act(r,'b',{action:'return',game},end);assert.deepEqual(view(r,'b',2).players.map(p=>p.id),seats);
 act(r,'a',{action:'return',game},end);act(r,'c',{action:'return',game},end);
 assert.deepEqual(r.players.map(p=>p.id),seats);assert.equal(r.host,'a');assert.equal(r.players.find(p=>p.id==='b').ready,true);
 for(const p of view(r,'a',3).players)assert.equal(p.avatar,old.indexOf(p.id));
 assert.equal(advance(r,end+1000),false);assert.deepEqual(r.players.map(p=>p.id),seats);
});
