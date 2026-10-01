"use client";
import {Check,X,ArrowRight,Users} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {view} from '@/lib/game';
type State=ReturnType<typeof view>;
export function RelayVote({room,now,busy,error,onVote}:{room:State;now:number;busy:boolean;error:string;onVote:(success:boolean)=>void}){
 const vote=room.voting,album=vote?room.albums?.[vote.album]:null;
 const first=album?.entries[0],last=album?.entries.at(-1);
 return <>
  {vote&&<div className="vote-wait" role="status"><Users size={19}/><span>{vote.mine===null?'等你评判这条接龙':`你已投${vote.mine?'✓ 接龙成功':'✕ 未接成功'}，等待大家`}</span><strong>{vote.cast} / {vote.eligible} 人已评判 · {Math.max(0,Math.ceil((vote.endsAt-now)/1000))} 秒</strong></div>}
  <Dialog open={!!vote&&vote.mine===null}>
   <DialogContent className="relay-vote-dialog" showCloseButton={false} onEscapeKeyDown={e=>e.preventDefault()} onInteractOutside={e=>e.preventDefault()}>
    <DialogHeader><span className="eyebrow">第 {(vote?.album??0)+1} 条接龙 · 全员评判</span><DialogTitle>这条龙，接成功了吗？</DialogTitle><DialogDescription>看看原词和最后的猜词，你来判断大家有没有接住。</DialogDescription></DialogHeader>
    <div className="vote-comparison"><div><span>最初的词</span><strong>{first?.skipped?'未选词':first?.text||'—'}</strong></div><ArrowRight size={21}/><div><span>最后猜成了</span><strong>{last?.skipped?'未完成猜词':last?.text||'—'}</strong></div></div>
    <div className="vote-buttons"><button className="vote-choice vote-yes" disabled={busy} onClick={()=>onVote(true)}><span><Check size={38} strokeWidth={3}/></span><strong>接龙成功</strong><small>意思接住了！</small></button><button className="vote-choice vote-no" disabled={busy} onClick={()=>onVote(false)}><span><X size={38} strokeWidth={3}/></span><strong>未接成功</strong><small>脑洞已经跑偏</small></button></div>
    {error&&<p className="vote-error" role="alert">{error}</p>}
    <p className="vote-rule">对号多于错号才算成功，平票算未成功。<br/>{Math.max(0,Math.ceil(((vote?.endsAt??now)-now)/1000))} 秒内评判，未投票不计票。</p>
   </DialogContent>
  </Dialog>
  {!!room.verdicts.length&&<div className="vote-results" aria-label="接龙评判结果">{room.verdicts.map(result=><div key={result.album} className={result.success?'verdict success':'verdict failed'}><span className="verdict-icon">{result.success?<Check size={23}/>:<X size={23}/>}</span><div><strong>{room.albums?.[result.album]?.owner||'朋友'} 的接龙 · {result.success?'成功':'未成功'}</strong><p>✓ {result.yes} 票 · ✕ {result.no} 票{result.abstained?` · ${result.abstained} 人未评判`:''}</p></div></div>)}</div>}
 </>;
}
