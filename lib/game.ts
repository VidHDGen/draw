import {dealWordDecks} from './words.ts';
import {makeReplaySchedule,REPLAY_LEAD_MS} from './replay-clock.ts';
export type Entry = { kind: 'text' | 'draw'; text?: string; image?: string; replay?: boolean; replayMs?:number; width?:number; height?:number; skipped?: boolean; author: string };
export type Player = { id: string; name: string; secret: string; left?: boolean };
export type Room = { code: string; host: string; players: Player[]; phase: 'lobby'|'play'|'reveal'; game: string; round: number; duration: number; deadline: number; entries: (Entry|null)[][]; prompts?: Record<string,{deck:string[];batch:number}>; replayStartsAt?:number; wordHistory?:string[] };
export class GameError extends Error { constructor(message: string, public status = 400) {super(message)} }
export function kind(round:number):'text'|'draw' { return round % 2 ? 'draw' : 'text' }
export function advance(room:Room, now=Date.now()) {
  if(room.phase==='reveal'&&!room.replayStartsAt){room.replayStartsAt=now+REPLAY_LEAD_MS;return true}
  if(room.phase !== 'play') return false;
  const row = room.entries[room.round];
  let changed = false;
  room.players.forEach((p,i)=>{if(!row[i] && (p.left || now>=room.deadline)){row[i]={kind:kind(room.round),author:p.id,skipped:true};changed=true}});
  if(row.filter(Boolean).length===room.players.length){
    if(room.round+1>=room.players.length){room.phase='reveal';room.replayStartsAt=now+REPLAY_LEAD_MS}
    else {room.round++;room.deadline=now+room.duration*1000}
    changed=true;
  }
  return changed;
}
export function view(room:Room, secret:string, version:number) {
  const index=room.players.findIndex(p=>p.secret===secret);
  if(index<0) throw new GameError('请重新加入这个房间。',401);
  const me=room.players[index];
  const offer=room.phase==='play'&&room.round===0?room.prompts?.[me.id]:undefined;
  const previous=room.phase==='play' && room.round>0 ? room.entries[room.round-1][(index-1+room.players.length)%room.players.length] : null;
  return {code:room.code,host:room.host,me:me.id,phase:room.phase,game:room.game,round:room.round,total:room.players.length,duration:room.duration,deadline:room.deadline,serverNow:Date.now(),version,kind:kind(room.round),previous,replaySchedule:room.phase==='reveal'&&room.replayStartsAt?makeReplaySchedule(room.entries,room.replayStartsAt):null,choices:offer?offer.deck.slice(offer.batch*3,offer.batch*3+3):null,choiceSet:offer?.batch??0,rerollsLeft:offer?3-offer.batch:0,submitted:!!room.entries[room.round]?.[index],players:room.players.map((p,i)=>({id:p.id,name:p.name,left:!!p.left,submitted:!!room.entries[room.round]?.[i]})),albums:room.phase==='reveal'?room.players.map((p,i)=>({owner:p.name,entries:room.entries.map((row,r)=>row[(i+r)%room.players.length])})):null};
}
export function act(room:Room, secret:string, body:Record<string,unknown>, now=Date.now()) {
  const index=room.players.findIndex(p=>p.secret===secret);
  const player=room.players[index];
  const action=body.action;
  if(action==='join') {
    if(player){player.left=false;return}
    if(room.phase!=='lobby') throw new GameError('游戏已经开始，等朋友下一局再加入吧。',409);
    if(room.players.length>=12) throw new GameError('房间已满，最多 12 人。',409);
    const name=validName(body.name);
    if(room.players.some(p=>p.name===name)) throw new GameError('这个昵称有人用了，换一个吧。');
    room.players.push({id:crypto.randomUUID(),secret,name});return;
  }
  if(!player) throw new GameError('请重新加入这个房间。',401);
  if(action==='leave') {
    if(room.phase==='lobby') room.players.splice(index,1); else player.left=true;
    if(room.host===player.id) room.host=room.players.find(p=>!p.left)?.id || '';
    advance(room,now);return;
  }
  if(player.left) throw new GameError('你已离开房间，请重新加入。',401);
  if(action==='start') {
    if(room.host!==player.id) throw new GameError('只有房主可以开始。',403);
    if(room.phase!=='lobby') return;
    if(room.players.length<3) throw new GameError('至少需要 3 位朋友才能开始。');
    const duration=Number(body.duration);
    if(![60,90,120,180].includes(duration)) throw new GameError('请选择有效的回合时长。');
    room.duration=duration;room.phase='play';room.round=0;room.game=crypto.randomUUID();room.deadline=now+duration*1000;
    delete room.replayStartsAt;
    const dealt=dealWordDecks(room.players.length,room.wordHistory);room.wordHistory=dealt.history;
    room.prompts=Object.fromEntries(room.players.map((p,i)=>[p.id,{deck:dealt.decks[i],batch:0}]));
    room.entries=Array.from({length:room.players.length},()=>Array(room.players.length).fill(null));return;
  }
  if(action==='reroll') {
    const offer=room.prompts?.[player.id];
    if(room.phase!=='play'||room.round!==0||body.game!==room.game||room.entries[0][index]||!offer)throw new GameError('现在不能换词。',409);
    if(body.choiceSet!==offer.batch)throw new GameError('词组选项已更新，请稍后重试。',409);
    if(offer.batch>=3)throw new GameError('三次换词机会已经用完。',409);
    offer.batch++;return;
  }
  if(action==='restart') {
    if(room.host!==player.id) throw new GameError('只有房主可以开启下一局。',403);
    if(room.phase!=='reveal') throw new GameError('请先完成这一局。',409);
    if(!room.replayStartsAt||now<makeReplaySchedule(room.entries,room.replayStartsAt).endsAt)throw new GameError('大家正在同步观看回放，请等放映结束。',409);
    room.players=room.players.filter(p=>!p.left);room.phase='lobby';room.round=0;room.entries=[];delete room.prompts;delete room.replayStartsAt;return;
  }
  if(action==='submit') {
    if(room.phase!=='play' || body.game!==room.game || body.round!==room.round) throw new GameError('这一轮已经结束，正在同步下一轮。',409);
    if(room.entries[room.round][index]) return;
    const entry:Entry={kind:kind(room.round),author:player.id};
    if(entry.kind==='text') {
      if(typeof body.text!=='string'|| !body.text.trim() || body.text.trim().length>80) throw new GameError('写下 1–80 个字再传给下一位吧。');
      const offer=room.prompts?.[player.id];
      if(room.round===0&&offer&&!offer.deck.slice(offer.batch*3,offer.batch*3+3).includes(body.text.trim()))throw new GameError('请从当前三个词中选择一个。');
      entry.text=body.text.trim();
    } else {
      if(typeof body.imageKey!=='string') throw new GameError('画作还没有保存，请重试。');
      entry.image=body.imageKey;
      if(body.hasReplay===true){entry.replay=true;entry.replayMs=Number(body.replayMs)||6000}
      if(typeof body.boardWidth==='number'&&typeof body.boardHeight==='number'){entry.width=body.boardWidth;entry.height=body.boardHeight}
    }
    room.entries[room.round][index]=entry;advance(room,now);return;
  }
  throw new GameError('不支持的操作。');
}
export function validName(name:unknown){if(typeof name!=='string'||!name.trim()||name.trim().length>12)throw new GameError('请输入 1–12 个字的昵称。');return name.trim()}
