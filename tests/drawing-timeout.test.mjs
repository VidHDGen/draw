import {test} from 'node:test';
import assert from 'node:assert/strict';
import {act,advance,view} from '../lib/game.ts';
import {DrawingDelivery,DRAWING_UPLOAD_GRACE_MS} from '../lib/drawing-timeout.ts';

function room(){const players=['a','b','c'].map(id=>({id,name:id,secret:id}));return {code:'ABCDEF',host:'a',players,phase:'play',game:'game',round:1,duration:60,deadline:60000,entries:[players.map(p=>({kind:'text',text:'word',author:p.id})),[null,null,null],[null,null,null]]}}
function drawing(r,id,action,key,time,received=time){act(r,id,{action,game:r.game,round:1,imageKey:key,hasReplay:true,replayMs:6000,boardWidth:600,boardHeight:800,draftAt:received},time)}

test('server submits latest saved drawing and replay after timeout even without any client submission',()=>{
 const r=room();drawing(r,'a','draft','old',1000);drawing(r,'a','draft','latest',2000);
 drawing(r,'a','draft','slow-older-upload',3000,1500);
 assert.equal(r.entries[1][0],null);assert.equal(view(r,'b',1).drafts,undefined);
 assert.equal(advance(r,60000),false);assert.equal(advance(r,60000+DRAWING_UPLOAD_GRACE_MS-1),false);
 assert.equal(advance(r,60000+DRAWING_UPLOAD_GRACE_MS),true);assert.equal(r.round,2);
 assert.deepEqual(r.entries[1][0],{kind:'draw',author:'a',image:'latest',replay:true,replayMs:6000,width:600,height:800});
 assert.equal(r.entries[1][1].skipped,true);assert.equal(r.drafts,undefined);
 assert.equal(view(r,'b',2).previous.image,'latest');
 assert.throws(()=>drawing(r,'a','draft','stale',71000),e=>e.status===409);
});

test('final upload can finish after the visible deadline and wins over a pending autosave',()=>{
 const r=room();drawing(r,'a','draft','backup',1000);
 drawing(r,'b','submit','b',2000);drawing(r,'c','submit','c',3000);
 assert.equal(advance(r,60001),false);
 drawing(r,'a','submit','final-with-last-stroke',60002);
 assert.equal(r.round,2);assert.equal(r.entries[1][0].image,'final-with-last-stroke');
 assert.throws(()=>drawing(r,'a','draft','delayed',60003),e=>e.status===409);
 const late=room();assert.throws(()=>drawing(late,'a','submit','too-late',60000+DRAWING_UPLOAD_GRACE_MS),e=>e.status===409);
});

test('manual submission is preserved and old backups never leak into another round',()=>{
 const r=room();drawing(r,'a','draft','backup',1000);drawing(r,'a','submit','manual',2000);
 drawing(r,'a','draft','late-backup',3000);assert.equal(r.entries[1][0].image,'manual');
 advance(r,70000);assert.equal(r.drafts,undefined);advance(r,130000);
 assert.equal(r.entries[2][0].kind,'text');assert.equal(r.entries[2][0].image,undefined);
});

function client(overrides={}){
 let now=0,revision=0;const sent=[],statuses=[],freezes=[];
 const delivery=new DrawingDelivery({deadline:10000,now:()=>now,revision:()=>revision,
 snapshot:freeze=>{freezes.push(freeze);return {image:'image-'+revision,recording:{version:1,actions:[]}}},
 send:async(action,snapshot)=>{sent.push({action,...snapshot})},status:s=>statuses.push(s),...overrides});
 return {delivery,sent,statuses,freezes,time:v=>{now=v},edit:()=>{revision++}};
}

test('client backs up a blank canvas, saves edits, and submits at zero even after missing the old three-second window',async()=>{
 const c=client();await c.delivery.tick();assert.equal(c.sent[0].action,'draft');
 c.time(4000);await c.delivery.tick();assert.equal(c.sent.length,1);
 c.edit();await c.delivery.tick();assert.equal(c.sent[1].image,'image-1');
 c.time(10500);c.edit();await c.delivery.tick();assert.equal(c.sent[2].action,'submit');assert.equal(c.sent[2].image,'image-2');assert.equal(c.freezes.at(-1),true);
 await c.delivery.tick();assert.equal(c.sent.length,3);
});

test('deadline submission bypasses a slow autosave and retries the same frozen drawing on a transient error',async()=>{
 let release;const sent=[];let fail=true;
 const c=client({send:async(action,snapshot)=>{sent.push({action,...snapshot});if(action==='draft')await new Promise(resolve=>{release=resolve});else if(fail){fail=false;throw Error('offline')}}});
 const saving=c.delivery.tick();c.time(10000);c.edit();await c.delivery.tick();
 assert.equal(sent[1].action,'submit');assert.equal(c.statuses.at(-1),'retrying');
 c.time(11500);c.edit();await c.delivery.tick();assert.equal(sent[2].image,'image-1');assert.equal(c.freezes.filter(Boolean).length,1);
 release();await saving;await c.delivery.tick();assert.equal(sent.length,3);
});

test('failed backups retry without a new stroke; stopped or expired clients do not send stale work',async()=>{
 let fail=true;const sent=[];const c=client({send:async(action,snapshot)=>{sent.push({action,...snapshot});if(fail){fail=false;throw Error('offline')}}});
 await c.delivery.tick();c.time(4000);await c.delivery.tick();assert.equal(sent.length,2);
 c.time(20000);await c.delivery.tick();assert.equal(sent.length,2);
 c.delivery.stop();c.edit();await c.delivery.tick();assert.equal(sent.length,2);
});
