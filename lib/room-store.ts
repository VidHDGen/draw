import { env } from 'cloudflare:workers';
import { GameError, Room } from './game';
export function database(){if(!env.DB)throw new Error('DB unavailable');return env.DB}
export function bucket(){if(!env.BUCKET)throw new Error('BUCKET unavailable');return env.BUCKET}
export async function readRoom(code:string){
  const row=await database().prepare('SELECT payload, version, expires FROM rooms WHERE code = ?').bind(code).first<{payload:string;version:number;expires:number}>();
  if(!row || row.expires<Date.now()) throw new GameError('房间不存在或已过期，请确认房间码。',404);
  return {room:JSON.parse(row.payload) as Room,version:row.version};
}
export async function updateRoom(code:string, change:(room:Room)=>boolean|void){
  for(let retry=0;retry<8;retry++){
    const {room,version}=await readRoom(code);
    if(change(room)===false)return {room,version};
    const result=await database().prepare('UPDATE rooms SET payload = ?, version = version + 1 WHERE code = ? AND version = ?').bind(JSON.stringify(room),code,version).run();
    if(result.meta.changes) return {room,version:version+1};
  }
  throw new GameError('大家正在同时操作，请再试一次。',409);
}
export async function secretFrom(request:Request){
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(!/^[a-f0-9-]{36,100}$/i.test(token))throw new GameError('请刷新页面后重新加入。',401);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('');
}
