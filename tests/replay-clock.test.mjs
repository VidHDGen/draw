import {test} from 'node:test';
import assert from 'node:assert/strict';
import {act,advance,view} from '../lib/game.ts';
import {replayPosition,INTRO_MS,REPLAY_LEAD_MS} from '../lib/replay-clock.ts';

function finished(){
 const players=['a','b','c'].map(id=>({id,name:id,secret:id}));
 return {code:'ABCDEF',host:'a',players,phase:'play',game:'game',round:2,duration:60,deadline:1000,
 entries:[players.map(p=>({kind:'text',author:p.id,text:'词'})),players.map(p=>({kind:'draw',author:p.id,image:'image',replay:true,replayMs:5000})),[null,null,null]]};
}
test('timeout persists a single shared replay epoch, reconnect does not restart it',()=>{
 const r=finished();assert.equal(advance(r,1000),true);assert.equal(r.phase,'reveal');assert.equal(r.replayStartsAt,1000+REPLAY_LEAD_MS);
 const plan=view(r,'a',1).replaySchedule;assert.equal(plan.steps.length,9);
 assert.deepEqual(view(r,'b',1).replaySchedule,plan);assert.equal(advance(r,9000),false);
 assert.deepEqual(view(JSON.parse(JSON.stringify(r)),'c',2).replaySchedule,plan);
 assert.equal(replayPosition(plan,plan.startsAt-1).waiting,true);
 assert.equal(replayPosition(plan,plan.startsAt).introElapsed,0);
 assert.equal(plan.steps[0].contentAt-plan.startsAt,INTRO_MS);
 const drawing=plan.steps[1];assert.equal(replayPosition(plan,drawing.contentAt+2500).progress,.5);
 assert.equal(replayPosition(plan,drawing.endsAt).index,2);
 assert.equal(replayPosition(plan,plan.endsAt).ended,true);
 assert.throws(()=>act(r,'a',{action:'restart'},plan.endsAt-1),e=>e.status===409);
 act(r,'a',{action:'restart'},plan.endsAt);assert.equal(r.phase,'lobby');assert.equal(r.replayStartsAt,undefined);
});
test('last submission starts automatic replay; legacy reveal rooms acquire an epoch only once',()=>{
 const r=finished();r.deadline=10000;r.entries[2][0]={kind:'text',author:'a',text:'猜'};r.entries[2][1]={kind:'text',author:'b',text:'猜'};
 act(r,'c',{action:'submit',game:'game',round:2,text:'猜'},500);assert.equal(r.replayStartsAt,5500);
 delete r.replayStartsAt;assert.equal(advance(r,7000),true);assert.equal(r.replayStartsAt,12000);assert.equal(advance(r,8000),false);
});
