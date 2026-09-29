"use client";
import {useState} from 'react';
import {Users} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {view} from '@/lib/game';
type State=ReturnType<typeof view>;
export function PlayerManager({room,busy,onKick}:{room:State;busy:boolean;onKick:(id:string)=>Promise<void>}){
 const [open,setOpen]=useState(false),[target,setTarget]=useState<string|null>(null);
 const player=room.players.find(p=>p.id===target&&!p.left);
 return <Dialog open={open} onOpenChange={value=>{setOpen(value);setTarget(null)}}><button className="text-button" onClick={()=>setOpen(true)}><Users size={17}/>管理玩家</button><DialogContent><DialogHeader><DialogTitle>房间玩家</DialogTitle><DialogDescription>房主可以移出其他玩家。进行中的接龙会继续，被移出玩家的后续回合将跳过。</DialogDescription></DialogHeader>
  <div className="manager-list">{room.players.filter(p=>!p.left).map(p=><div className="manager-row" key={p.id}><span className={`avatar small avatar-${p.avatar}`}>{p.name.slice(0,1)}</span><strong>{p.name}</strong>{p.id===room.host?<span className="muted">房主</span>:<button className="text-button kick-button" disabled={busy} onClick={()=>setTarget(p.id)}>移出 {p.name}</button>}</div>)}</div>
  {player&&<div className="kick-confirm" role="alert"><p>将「{player.name}」移出房间？本房间将不再允许其当前身份加入。</p><div><button className="secondary" disabled={busy} onClick={()=>setTarget(null)}>取消</button><button className="primary" disabled={busy} onClick={async()=>{await onKick(player.id);setTarget(null)}}>确认移出</button></div></div>}
 </DialogContent></Dialog>
}
