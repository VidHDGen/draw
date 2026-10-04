import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://localhost:5173';
const tokens=Array.from({length:3},()=>crypto.randomUUID()+crypto.randomUUID());
let code;
async function post(i,action,data={},expected=200){const response=await fetch(base+'/api/room',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens[i]},body:JSON.stringify({action,code,...data})});const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result}
async function get(i){const response=await fetch(base+'/api/room?code='+code,{headers:{Authorization:'Bearer '+tokens[i]}});assert.equal(response.status,200);return response.json()}
async function until(time){while(Date.now()<time)await new Promise(resolve=>setTimeout(resolve,Math.min(1000,time-Date.now())))}
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const stroke={type:'stroke',stroke:{color:'#2548f4',width:6,points:[{x:10,y:20},{x:25,y:30}]}};
const first={version:1,width:600,height:800,actions:[stroke]};
const latest={...first,actions:[stroke,{type:'clear'},{type:'undo'},{...stroke,stroke:{...stroke.stroke,points:[{x:50,y:700},{x:70,y:760}]}}]};
let state=await post(0,'create',{name:'超时保存测试'});code=state.code;
const ids=[state.me];for(let i=1;i<3;i++){ids[i]=(await post(i,'join',{name:'自动交卷'+i})).me;await post(i,'ready',{game:'',ready:true})}
state=await post(0,'start',{duration:60});const game=state.game;
for(let i=0;i<3;i++){const offer=await get(i);await post(i,'submit',{game,round:0,text:offer.choices[0]})}
state=await get(0);assert.equal(state.round,1);const deadline=state.deadline;
await post(0,'draft',{game,round:1,imageKey:'forged',draftAt:Number.MAX_SAFE_INTEGER},400);
await post(0,'draft',{game,round:1,image,recording:first});
state=await post(0,'draft',{game,round:1,image,recording:latest});
assert.equal(state.submitted,false);assert.equal(state.drafts,undefined);
await post(1,'draft',{game,round:1,image,recording:first});
await post(2,'submit',{game,round:1,image,recording:first});
console.log('Waiting for real 60-second deadline: player 0 stops submitting; player 1 uploads the final drawing after zero. Room '+code);
await until(deadline+1500);
assert.equal((await get(1)).round,1);
state=await post(1,'submit',{game,round:1,image,recording:latest});assert.equal(state.submitted,true);
await until(deadline+10500);
state=await get(1);assert.equal(state.round,2);assert.equal(state.previous.author,ids[0]);assert.ok(state.previous.image);assert.ok(!state.previous.skipped);assert.equal(state.previous.replay,true);
const savedKey=state.previous.image;
assert.equal((await fetch(base+'/api/drawing?code='+code+'&key='+encodeURIComponent(savedKey),{headers:{Authorization:'Bearer '+tokens[1]}})).status,200);
await post(0,'draft',{game,round:1,image,recording:first},409);
for(let i=0;i<3;i++)await post(i,'submit',{game,round:2,text:'自动交卷成功'});
state=await get(0);assert.equal(state.phase,'reveal');
for(let i=0;i<2;i++){
 const entry=state.albums.flatMap(a=>a.entries).find(e=>e.kind==='draw'&&e.author===ids[i]);assert.ok(entry?.image&&!entry.skipped);
 const response=await fetch(base+'/api/drawing?code='+code+'&key='+encodeURIComponent(entry.image)+'&replay=1',{headers:{Authorization:'Bearer '+tokens[0]}});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),latest);
}
console.log('PASS: timeout saved the latest cloud draft, post-deadline final upload succeeded, drawing and all replay actions survived, stale uploads rejected.');
