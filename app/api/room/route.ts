import { act, advance, GameError, Room, validName, view } from '@/lib/game';
import { bucket, database, readRoom, secretFrom, updateRoom } from '@/lib/room-store';
import {validateRecording} from '@/lib/drawing';
export const dynamic='force-dynamic';
function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
function fail(error:unknown){if(error instanceof GameError)return json({error:error.message},error.status);console.error('Room service',error);return json({error:'暂时无法连接房间，你的内容会保留，请稍后重试。'},503)}
function codeFrom(value:unknown){if(typeof value!=='string'||! /^[A-Z2-9]{6}$/.test(value))throw new GameError('请输入正确的 6 位房间码。');return value}
export async function GET(request:Request){try{
  const secret=await secretFrom(request),code=codeFrom(new URL(request.url).searchParams.get('code'));
  const result=await updateRoom(code,room=>{view(room,secret,0);return advance(room)});
  return json(view(result.room,secret,result.version));
}catch(e){return fail(e)}}
export async function POST(request:Request){try{
  if(request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin)throw new GameError('请从游戏页面操作。',403);
  if(Number(request.headers.get('content-length')||0)>1800000)throw new GameError('画作太大，请简化后重试。',413);
  const raw=await request.text();if(raw.length>1800000)throw new GameError('画作太大，请简化后重试。',413);
  let body:Record<string,unknown>;try{body=JSON.parse(raw)}catch{throw new GameError('请求格式错误。')}
  if(!body || typeof body!=='object' || Array.isArray(body))throw new GameError('请求格式错误。');
  const secret=await secretFrom(request);
  if(body.action==='create'){
    const name=validName(body.name),id=crypto.randomUUID();
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for(let tries=0;tries<5;tries++){
      const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>alphabet[n%alphabet.length]).join('');
      const room:Room={code,host:id,players:[{id,name,secret}],phase:'lobby',round:0,game:'',duration:90,deadline:0,entries:[]};
      const result=await database().prepare('INSERT OR IGNORE INTO rooms (code,payload,version,expires) VALUES (?,?,0,?)').bind(code,JSON.stringify(room),Date.now()+86400000).run();
      if(result.meta.changes)return json(view(room,secret,0));
    }
    throw new GameError('创建房间失败，请再试一次。',503);
  }
  const code=codeFrom(body.code);
  // Only the server may assign an object key to a submitted drawing.
  delete body.imageKey;
  delete body.hasReplay;
  if(body.action==='submit' && typeof body.image==='string'){
    const {room}=await readRoom(code);view(room,secret,0);
    const player=room.players.find(p=>p.secret===secret)!;
    if(room.phase!=='play'||body.game!==room.game||body.round!==room.round||room.round%2!==1||player.left||Date.now()>=room.deadline)throw new GameError('这一轮已经结束，正在同步下一轮。',409);
    if(room.entries[room.round][room.players.indexOf(player)])return json(view(room,secret,0));
    const match=/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(body.image);
    if(!match)throw new GameError('画作格式错误，请重新提交。');
    let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0))}catch{throw new GameError('画作格式错误。')}
    const dv=new DataView(bytes.buffer);
    if(bytes.length<24||bytes.length>440000||dv.getUint32(0)!==0x89504e47||dv.getUint32(4)!==0x0d0a1a0a||dv.getUint32(16)>1600||dv.getUint32(20)>1200)throw new GameError('画作尺寸不正确，请重试。');
    const key=`${code}/${room.game}/${room.round}/${player.id}/${crypto.randomUUID()}.png`;
    if(body.recording!==undefined){
      let recording;try{recording=validateRecording(body.recording)}catch(e){throw new GameError((e as Error).message)}
      await bucket().put(key+'.json',JSON.stringify(recording),{httpMetadata:{contentType:'application/json'}});body.hasReplay=true;
    }
    await bucket().put(key,bytes,{httpMetadata:{contentType:'image/png'}});body.imageKey=key;
  }
  const result=await updateRoom(code,room=>{
    if(body.action!=='join')view(room,secret,0);
    // Advance first so a stale submission can never overwrite a new round.
    const changed=advance(room);
    if(body.action==='submit' && (body.round!==room.round||room.phase!=='play')){if(changed)return true;throw new GameError('这一轮已经结束，正在同步下一轮。',409)}
    act(room,secret,body);return true;
  });
  if(body.action==='leave')return json({left:true});
  return json(view(result.room,secret,result.version));
}catch(e){return fail(e)}}
