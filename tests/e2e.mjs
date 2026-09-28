import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const tokens=Array.from({length:4},()=>crypto.randomUUID()+crypto.randomUUID());
let code;
async function post(i,action,data={},expected=200){const r=await fetch(base+'/api/room',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens[i]},body:JSON.stringify({action,code,...data})});const v=await r.json();assert.equal(r.status,expected,JSON.stringify(v));return v}
async function get(i,expected=200){const r=await fetch(base+'/api/room?code='+code,{headers:{Authorization:'Bearer '+tokens[i]}});const v=await r.json();assert.equal(r.status,expected,JSON.stringify(v));return v}
let state=await post(0,'create',{name:'测试房主'});code=state.code;
await post(0,'start',{duration:60},400);
const joined=await Promise.all([post(1,'join',{name:'测试画友甲'}),post(2,'join',{name:'测试画友乙'})]);
const tokenIndexById=new Map([[state.me,0],...joined.map((s,i)=>[s.me,i+1])]);
state=await get(0);assert.equal(state.players.length,3);assert.ok(!JSON.stringify(state).includes('secret'));
// Concurrent joins can finish in either order; rotation follows the server's seats.
const seats=state.players.map(p=>p.id);
const lastSeatToken=tokenIndexById.get(seats[2]);
await get(3,401);await post(1,'start',{duration:60},403);
state=await post(0,'start',{duration:60});const game=state.game;
await post(3,'join',{name:'迟来的朋友'},409);
await Promise.all(tokens.slice(0,3).map((_,i)=>post(i,'submit',{game,round:0,text:'脑洞'+i})));
state=await get(0);assert.equal(state.round,1);assert.equal(state.albums,null);assert.equal(state.previous.text,'脑洞'+lastSeatToken);
await post(0,'submit',{game,round:0,text:'过期答案'},409);
await post(0,'submit',{game,round:1,imageKey:'forged'},400);
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
await Promise.all(tokens.slice(0,3).map((_,i)=>post(i,'submit',{game,round:1,image})));
state=await get(0);assert.equal(state.round,2);assert.ok(state.previous.image);
const imageUrl=base+'/api/drawing?code='+code+'&key='+encodeURIComponent(state.previous.image);
assert.equal((await fetch(imageUrl,{headers:{Authorization:'Bearer '+tokens[0]}})).status,200);
assert.equal((await fetch(imageUrl,{headers:{Authorization:'Bearer '+tokens[3]}})).status,401);
await Promise.all(tokens.slice(0,3).map((_,i)=>post(i,'submit',{game,round:2,text:'猜词'+i})));
state=await get(0);assert.equal(state.phase,'reveal');assert.equal(state.albums.length,3);
state.albums.forEach((album,i)=>album.entries.forEach((entry,r)=>{
  const author=seats[(i+r)%seats.length];
  assert.equal(entry.author,author);
  if(r!==1)assert.equal(entry.text,(r===0?'脑洞':'猜词')+tokenIndexById.get(author));
}));
await post(1,'restart',{},403);state=await post(0,'restart');assert.equal(state.phase,'lobby');
await post(0,'leave');state=await get(1);assert.equal(state.host,seats[1]);assert.equal(state.players.length,2);
console.log('PASS: concurrent 3-player full game, rotation, image storage, answer isolation, auth, stale writes, restart, host transfer.');
console.log('QA_ROOM='+code);
