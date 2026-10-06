import {DRAWING_UPLOAD_GRACE_MS} from './drawing-timeout.ts';
import {dealWordDecks} from './words.ts';
import {makeReplaySchedule,REPLAY_LEAD_MS} from './replay-clock.ts';
export type Entry = { kind: 'text' | 'draw'; text?: string; image?: string; replay?: boolean; replayMs?:number; width?:number; height?:number; skipped?: boolean; author: string };
export type Player = { id: string; name: string; secret: string; left?: boolean; ready?:boolean; returned?:boolean; kicked?:boolean; avatar?:number };
export type Room = { code: string; host: string; players: Player[]; phase: 'lobby'|'play'|'reveal'; game: string; round: number; duration: number; deadline: number; entries: (Entry|null)[][]; prompts?: Record<string,{deck:string[];batch:number}>; replayStartsAt?:number; wordHistory?:string[]; removed?:string[]; drafts?:Record<string,{entry:Entry;savedAt:number}>; lobbyOrder?:string[]; flow?:'self-draw'; replayAlbum?:number; replayFinished?:boolean; votes?:Record<string,Record<string,boolean>>; verdicts?:{album:number;yes:number;no:number;abstained:number;success:boolean}[] };
export class GameError extends Error { constructor(message: string, public status = 400, public code?:string) {super(message)} }
export function kind(round:number):'text'|'draw' { return round % 2 ? 'draw' : 'text' }
export const VOTE_MS=30000;
export function relayOffset(room:Room,round:number){return room.flow==='self-draw'?Math.max(0,round-1):round}
export function replaySchedule(room:Room){return makeReplaySchedule(room.entries,room.replayStartsAt||0,room.flow==='self-draw'?{album:room.replayAlbum||0,selfDraw:true}:undefined)}
export function advance(room:Room, now=Date.now()) {
  if(room.phase!=='lobby'&&room.players.every(p=>p.left)){room.players=[];room.host='';room.phase='lobby';room.round=0;room.entries=[];delete room.prompts;delete room.replayStartsAt;delete room.drafts;delete room.lobbyOrder;return true}
  if(room.phase==='reveal'&&!room.replayStartsAt){room.replayStartsAt=now+REPLAY_LEAD_MS;return true}
  if(room.phase==='reveal'&&room.flow==='self-draw'&&!room.replayFinished){
    const schedule=replaySchedule(room),album=room.replayAlbum||0,votes=room.votes?.[album]||{},voters=room.players.filter(p=>!p.left);
    if(now>=schedule.endsAt&&(now>=schedule.endsAt+VOTE_MS||voters.every(p=>typeof votes[p.id]==='boolean'))){
      const yes=voters.filter(p=>votes[p.id]===true).length,no=voters.filter(p=>votes[p.id]===false).length;
      room.verdicts??=[];room.verdicts.push({album,yes,no,abstained:voters.length-yes-no,success:yes>no});
      if(album+1>=room.players.length)room.replayFinished=true;else{room.replayAlbum=album+1;room.replayStartsAt=now+REPLAY_LEAD_MS}
      return true;
    }
  }
  if(room.phase==='reveal'&&room.players.some(p=>!p.left)&&room.players.filter(p=>!p.left).every(p=>p.returned)){room.players=room.players.filter(p=>!p.left).sort((a,b)=>(room.lobbyOrder?.indexOf(a.id)??0)-(room.lobbyOrder?.indexOf(b.id)??0));delete room.lobbyOrder;room.phase='lobby';room.round=0;room.entries=[];delete room.prompts;delete room.replayStartsAt;delete room.drafts;return true}
  if(room.phase !== 'play') return false;
  const row = room.entries[room.round];
  let changed = false;
  const expires=room.deadline+(kind(room.round)==='draw'?DRAWING_UPLOAD_GRACE_MS:0);
  room.players.forEach((p,i)=>{if(!row[i] && (p.left || now>=expires)){row[i]=room.drafts?.[p.id]?.entry??{kind:kind(room.round),author:p.id,skipped:true};changed=true}});
  if(row.filter(Boolean).length===room.players.length){
    delete room.drafts;
    if(room.round+1>=room.entries.length){room.phase='reveal';room.replayStartsAt=now+REPLAY_LEAD_MS}
    else {room.round++;room.deadline=now+room.duration*1000}
    changed=true;
  }
  return changed;
}
function checkAccess(room:Room,secret:string){if(room.removed?.includes(secret))throw new GameError('你已被房主移出房间。',403,'ROOM_KICKED')}
export function view(room:Room, secret:string, version:number) {
  checkAccess(room,secret);
  const index=room.players.findIndex(p=>p.secret===secret);
  if(index<0) throw new GameError('请重新加入这个房间。',401);
  const me=room.players[index];
  if(me.left)throw new GameError('你已离开房间，请重新加入。',401);
  const offer=room.phase==='play'&&room.round===0?room.prompts?.[me.id]:undefined;
  const previous=room.phase==='play' && room.round>0 ? room.entries[room.round-1][(index-(room.flow==='self-draw'&&room.round===1?0:1)+room.players.length)%room.players.length] : null;
  const phase=room.phase==='reveal'&&me.returned?'lobby':room.phase;
  const previousPlayer=room.phase==='play'&&room.round>0?room.players[(index-(room.flow==='self-draw'&&room.round===1?0:1)+room.players.length)%room.players.length]:undefined;
  const schedule=phase==='reveal'&&room.replayStartsAt?replaySchedule(room):null;
  const votes=room.votes?.[room.replayAlbum||0]||{},voters=room.players.filter(p=>!p.left);
  const voting=phase==='reveal'&&room.flow==='self-draw'&&!room.replayFinished&&schedule&&Date.now()>=schedule.endsAt?{album:room.replayAlbum||0,endsAt:schedule.endsAt+VOTE_MS,eligible:voters.length,cast:voters.filter(p=>typeof votes[p.id]==='boolean').length,mine:votes[me.id]??null}:null;
  const members=room.players.map((p,i)=>({id:p.id,name:p.name,avatar:p.avatar??i%6,left:!!p.left,ready:!!p.ready,returned:room.phase==='lobby'||!!p.returned,kicked:!!p.kicked,submitted:!!room.entries[room.round]?.[i]}));
  return {code:room.code,host:room.host,me:me.id,phase,game:room.game,round:room.round,total:room.entries.length||room.players.length,flow:room.flow??'legacy',voting,verdicts:room.verdicts||[],replayFinished:room.flow==='self-draw'?!!room.replayFinished:!!schedule&&Date.now()>=schedule.endsAt,duration:room.duration,deadline:room.deadline,serverNow:Date.now(),version,kind:kind(room.round),previous,previousPlayer:previousPlayer?{id:previousPlayer.id,name:previousPlayer.name,avatar:previousPlayer.avatar??room.players.indexOf(previousPlayer)%6}:null,canStart:room.phase==='lobby'&&room.players.length>=3&&room.players.every(p=>p.id===room.host||p.ready),replaySchedule:schedule,choices:offer?offer.deck.slice(offer.batch*3,offer.batch*3+3):null,nextChoices:offer&&offer.batch<3?offer.deck.slice((offer.batch+1)*3,(offer.batch+2)*3):null,choiceSet:offer?.batch??0,rerollsLeft:offer?3-offer.batch:0,submitted:!!room.entries[room.round]?.[index],players:phase==='lobby'?members.filter(p=>!p.left).sort((a,b)=>(room.lobbyOrder?.indexOf(a.id)??0)-(room.lobbyOrder?.indexOf(b.id)??0)):members,albums:phase==='reveal'?room.players.map((p,i)=>({owner:p.name,entries:room.entries.map((row,r)=>row[(i+relayOffset(room,r))%room.players.length])})):null};
}
export function act(room:Room, secret:string, body:Record<string,unknown>, now=Date.now()) {
  const index=room.players.findIndex(p=>p.secret===secret);
  const player=room.players[index];
  const action=body.action;
  if(action==='join') {
    const kicked=!!player?.kicked||!!room.removed?.includes(secret);
    if(kicked&&room.phase!=='lobby')throw new GameError('本局还在进行，请等大家返回房间后重新加入。',409);
    if(player){if(player.left||kicked){player.ready=false;player.returned=false}player.left=false;player.kicked=false;room.removed=room.removed?.filter(s=>s!==secret);return}
    if(room.phase!=='lobby') throw new GameError('游戏已经开始，等朋友下一局再加入吧。',409);
    if(room.players.length>=12) throw new GameError('房间已满，最多 12 人。',409);
    const name=validName(body.name);
    if(room.players.some(p=>p.name===name)) throw new GameError('这个昵称有人用了，换一个吧。');
    const id=crypto.randomUUID(),used=new Set(room.players.map((p,i)=>p.avatar??i%6));const avatar=[0,1,2,3,4,5].find(a=>!used.has(a))??room.players.length%6;room.players.push({id,secret,name,avatar});if(!room.host)room.host=id;room.removed=room.removed?.filter(s=>s!==secret);return;
  }
  checkAccess(room,secret);
  if(!player) throw new GameError('请重新加入这个房间。',401);
  if(action==='leave') {
    if(room.phase==='lobby'){room.players.forEach((p,i)=>{p.avatar??=i%6});room.players.splice(index,1);} else player.left=true;
    if(room.host===player.id) room.host=room.players.find(p=>!p.left)?.id || '';
    advance(room,now);return;
  }
  if(player.left) throw new GameError('你已离开房间，请重新加入。',401);
  if(action==='kick') {
    if(room.host!==player.id)throw new GameError('只有房主可以移出玩家。',403);
    if(body.playerId===player.id)throw new GameError('不能移出自己，请使用离开房间。');
    const target=room.players.find(p=>p.id===body.playerId&&!p.left);
    if(!target)throw new GameError('这位玩家已经离开房间。',404);
    room.removed=[...(room.removed||[]),target.secret];target.ready=false;target.left=true;target.kicked=true;
    if(room.phase==='lobby'){room.players.forEach((p,i)=>{p.avatar??=i%6});room.players=room.players.filter(p=>p.id!==target.id);}
    advance(room,now);return;
  }
  if(action==='ready') {
    if(body.game!==room.game)throw new GameError('房间状态已更新，请重新准备。',409);
    if(room.phase!=='lobby'&&!(room.phase==='reveal'&&player.returned))throw new GameError('请先返回房间再准备。',409);
    if(player.id===room.host)throw new GameError('房主等待大家准备后直接开始即可。',400);
    if(typeof body.ready!=='boolean')throw new GameError('准备状态无效。');
    player.ready=body.ready;return;
  }
  if(action==='start') {
    if(room.host!==player.id) throw new GameError('只有房主可以开始。',403);
    if(room.phase!=='lobby')throw new GameError('请等待大家返回房间并准备。',409);
    if(room.players.length<3) throw new GameError('至少需要 3 位朋友才能开始。');
    if(room.players.some(p=>p.id!==room.host&&!p.ready))throw new GameError('请等所有其他玩家准备好再开始。',409);
    const duration=Number(body.duration);
    if(![60,90,120,180].includes(duration)) throw new GameError('请选择有效的回合时长。');
    room.duration=duration;room.phase='play';room.round=0;room.game=crypto.randomUUID();room.deadline=now+duration*1000;
    room.players.forEach(p=>{p.ready=false;p.returned=false});
    delete room.replayStartsAt;delete room.drafts;
    const dealt=dealWordDecks(room.players.length,room.wordHistory);room.wordHistory=dealt.history;
    room.prompts=Object.fromEntries(room.players.map((p,i)=>[p.id,{deck:dealt.decks[i],batch:0}]));
    room.flow='self-draw';room.replayAlbum=0;room.replayFinished=false;room.votes={};room.verdicts=[];
    room.entries=Array.from({length:1+room.players.length-(room.players.length%2)},()=>Array(room.players.length).fill(null));return;
  }
  if(action==='reroll') {
    const offer=room.prompts?.[player.id];
    if(room.phase!=='play'||room.round!==0||body.game!==room.game||room.entries[0][index]||!offer)throw new GameError('现在不能换词。',409);
    if(body.choiceSet!==offer.batch)throw new GameError('词组选项已更新，请稍后重试。',409);
    if(offer.batch>=3)throw new GameError('三次换词机会已经用完。',409);
    offer.batch++;return;
  }
  if(action==='vote'){
    if(body.game!==room.game||room.phase!=='reveal'||room.flow!=='self-draw'||room.replayFinished||body.album!==(room.replayAlbum||0)||typeof body.success!=='boolean')throw new GameError('这条接龙的投票已经结束。',409);
    const schedule=replaySchedule(room);
    if(now<schedule.endsAt||now>=schedule.endsAt+VOTE_MS)throw new GameError('请在本条回放结束后的投票时间内评判。',409);
    room.votes??={};const votes=room.votes[String(body.album)]??={};
    if(typeof votes[player.id]==='boolean')return;
    votes[player.id]=body.success;advance(room,now);return;
  }
  if(action==='return'||action==='restart') {
    if(action==='return'&&body.game!==room.game)throw new GameError('这局已经结束，正在同步房间。',409);
    if(room.phase==='lobby')return;
    if(room.phase!=='reveal')throw new GameError('请先完成这一局。',409);
    if(!room.replayStartsAt||(room.flow==='self-draw'?!room.replayFinished:now<replaySchedule(room).endsAt))throw new GameError('大家正在同步观看回放，请等放映结束。',409);
    if(!room.lobbyOrder){
      room.players.forEach((p,i)=>{p.avatar??=i%6});
      const order=room.players.filter(p=>!p.left).map(p=>p.id),original=order.join(',');
      for(let i=order.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[order[i],order[j]]=[order[j],order[i]]}
      if(order.length>1&&order.join(',')===original)[order[0],order[1]]=[order[1],order[0]];
      room.lobbyOrder=order;
    }
    if(!player.returned){player.returned=true;player.ready=false}
    advance(room,now);return;
  }
  if(action==='submit'||action==='draft') {
    if(room.phase!=='play' || body.game!==room.game || body.round!==room.round) throw new GameError('这一轮已经结束，正在同步下一轮。',409);
    if(room.entries[room.round][index]) return;
    if(action==='draft'&&kind(room.round)!=='draw')throw new GameError('只有绘画回合可以保存画作。');
    if(kind(room.round)==='draw'&&now>=room.deadline+DRAWING_UPLOAD_GRACE_MS)throw new GameError('这一轮已经结束，正在同步下一轮。',409);
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
    if(action==='draft'){
      const savedAt=Number(body.draftAt);
      if(!Number.isFinite(savedAt))throw new GameError('保存时间无效。');
      room.drafts??={};
      if(!room.drafts[player.id]||savedAt>room.drafts[player.id].savedAt)room.drafts[player.id]={entry,savedAt};
      return;
    }
    room.entries[room.round][index]=entry;
    if(room.drafts)delete room.drafts[player.id];
    advance(room,now);return;
  }
  throw new GameError('不支持的操作。');
}
export function validName(name:unknown){if(typeof name!=='string'||!name.trim()||name.trim().length>12)throw new GameError('请输入 1–12 个字的昵称。');return name.trim()}
