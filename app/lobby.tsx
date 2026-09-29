"use client";
import {ArrowRight,Check,Copy,Crown,Link as LinkIcon,Users} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {toast} from 'sonner';
import type {view} from '@/lib/game';
type State=ReturnType<typeof view>;
export function Lobby({room,busy,duration,setDuration,onStart,onReady,copyInvite}:{room:State;busy:boolean;duration:string;setDuration:(v:string)=>void;onStart:()=>void;onReady:(value:boolean)=>void;copyInvite:()=>void}){
 const isHost=room.host===room.me,me=room.players.find(p=>p.id===room.me),others=room.players.filter(p=>p.id!==room.host),prepared=others.filter(p=>p.ready).length;
 return <div className="lobby-grid"><section className="card"><div className="section-head"><Users size={23}/><h2>等待朋友准备</h2><span className="mini-label">{room.players.length} / 12 人</span></div>
  <div className="players-grid">{room.players.map(p=><div className={`player-tile ${p.ready?'is-ready':''}`} key={p.id}><span className={`avatar avatar-${p.avatar}`}>{p.name.slice(0,1)}</span><strong>{p.name}{p.id===room.me?'（我）':''}</strong><span className="player-caption">{p.id===room.host?<><Crown size={13}/>房主{!p.returned?' · 仍在结算':''}</>:!p.returned?'仍在结算':p.ready?<><Check size={14}/>已准备</>:'未准备'}</span></div>)}{room.players.length<3&&Array.from({length:3-room.players.length},(_,i)=><div className="player-tile vacant" key={i}><span className="avatar">＋</span><strong>虚位以待</strong><span className="player-caption">邀请一位朋友</span></div>)}</div>
  <div className="waiting-note" role="status">{room.players.length<3?`再来 ${3-room.players.length} 位朋友就能开局`:room.canStart?'大家已准备，等待房主开始！':`其他玩家已准备 ${prepared} / ${others.length} 人，全部准备后才能开始。`}</div>
 </section><aside className="card invite-card"><span className="eyebrow">把快乐传出去</span><h2>邀请你的灵魂画友</h2><button className="room-code" onClick={()=>navigator.clipboard.writeText(room.code).then(()=>toast.success('房间码已复制')).catch(()=>toast.error('请手动复制房间码'))} aria-label={`复制房间码 ${room.code}`}>{room.code}<Copy size={19}/></button><button className="secondary" onClick={copyInvite}><LinkIcon size={18}/>复制邀请链接</button>
  <div className="settings"><label>每轮时间</label><Select value={isHost?duration:String(room.duration)} onValueChange={setDuration} disabled={!isHost||busy}><SelectTrigger className="duration-select"><SelectValue/></SelectTrigger><SelectContent>{[60,90,120,180].map(n=><SelectItem value={String(n)} key={n}>{n} 秒{n===90?' · 推荐':''}</SelectItem>)}</SelectContent></Select></div>
  {isHost?<button className="primary" disabled={busy||!room.canStart} onClick={onStart}>{room.canStart?(room.game?'大家准备好了，再来一局':'大家准备好了，开始游戏'):'等待大家准备'}<ArrowRight size={18}/></button>:<button className={me?.ready?'secondary':'primary'} disabled={busy} onClick={()=>onReady(!me?.ready)}>{me?.ready?'取消准备':'准备'}<Check size={18}/></button>}
  <p className="fine">{isHost?'所有非房主玩家准备后，即可开局。':me?.ready?'已准备，等待房主开始。':'准备好后，记得点击准备。'}</p>
 </aside></div>
}
