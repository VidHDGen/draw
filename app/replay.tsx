"use client";
import {useEffect,useRef,useState} from 'react';
import {Volume2,VolumeX,Shuffle,Users} from 'lucide-react';
import {DrawingImage} from './drawing-image';
import {actionUnits,paintDrawing,replayStrokes,validateRecording,BOARD_WIDTH,BOARD_HEIGHT} from '@/lib/drawing';
import {replayPosition,INTRO_MS,DOCK_MS} from '@/lib/replay-clock';
import {playGuessSound,soundReady,unlockSound} from '@/lib/sound';
import type {Recording} from '@/lib/drawing';
import type {view} from '@/lib/game';
type State=ReturnType<typeof view>;
type Cached={recording:Recording|null;failed:boolean};
export function GameReplay({room,token,isHost,busy,onRestart,clockOffset}:{room:State;token:string;isHost:boolean;busy:boolean;onRestart:()=>void;clockOffset:number}){
 const schedule=room.replaySchedule,albums=room.albums||[];
 const [now,setNow]=useState(()=>Date.now()+clockOffset),[sound,setSound]=useState(true),[ready,setReady]=useState(false),[,setLoaded]=useState(0);
 const offset=useRef(clockOffset),canvas=useRef<HTMLCanvasElement>(null),cache=useRef(new Map<string,Cached>()),lastSound=useRef('');
 offset.current=clockOffset;
 useEffect(()=>{let frame=0;const tick=()=>{setNow(Date.now()+offset.current);frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[]);
 useEffect(()=>{setReady(soundReady())},[now]);
 const position=schedule?replayPosition(schedule,now):null;
 const stage=position?.stage,index=position?.index||0,albumIndex=stage?.album||0,step=stage?.step||0,album=albums[albumIndex],entry=album?.entries[step]||null;
 const playerIndex=room.players.findIndex(p=>p.id===entry?.author),player=room.players[playerIndex];
 // Keep the current and next two drawings ready without letting fetch latency move the shared clock.
 const keys=(schedule?.steps.slice(index,index+3)||[]).map(s=>albums[s.album]?.entries[s.step]).filter(e=>e?.replay&&e.image).map(e=>e!.image!).join('\n');
 useEffect(()=>{const controller=new AbortController(),wanted=keys.split('\n').filter(Boolean);for(const key of cache.current.keys())if(!wanted.includes(key))cache.current.delete(key);
  for(const key of wanted){if(cache.current.has(key))continue;fetch(`/api/drawing?code=${room.code}&key=${encodeURIComponent(key)}&replay=1`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return validateRecording(await r.json())}).then(recording=>{if(!controller.signal.aborted){cache.current.set(key,{recording,failed:false});setLoaded(v=>v+1)}}).catch(e=>{if(e.name!=='AbortError'&&!controller.signal.aborted){cache.current.set(key,{recording:null,failed:true});setLoaded(v=>v+1)}})}
  return()=>controller.abort();
 },[keys,room.code,token]);
 const cached=entry?.image?cache.current.get(entry.image):undefined,recording=cached?.recording;
 const progress=position?.progress||0,waiting=!position||position.waiting,ended=!!position?.ended;
 const showContent=!waiting&&now>=(stage?.contentAt||Infinity);
 const dock=Math.max(0,Math.min(1,((position?.introElapsed||0)-(INTRO_MS-DOCK_MS))/DOCK_MS));
 useEffect(()=>{const ctx=canvas.current?.getContext('2d');if(!ctx||!recording)return;const units=recording.actions.reduce((n,a)=>n+actionUnits(a),0);paintDrawing(ctx,replayStrokes(recording.actions,units*progress))},[recording,progress]);
 useEffect(()=>{if(!stage||!showContent||step===0||entry?.kind!=='text'||entry.skipped||ended)return;const soundKey=`${schedule?.startsAt}-${index}`;if(lastSound.current===soundKey)return;lastSound.current=soundKey;if(sound&&now-stage.contentAt<1200)playGuessSound()},[index,showContent,sound,stage,entry?.kind,entry?.skipped,step,ended,now,schedule?.startsAt]);
 const introLabel=step===0?'选中了一个开场词':entry?.kind==='draw'?'准备接过画笔':'准备说出猜测';
 return <section className="card cinema synced-cinema"><div className="reveal-heading"><div><span className="eyebrow">接龙放映室 · 全房间同步</span><h2>{waiting?'全员就位，回放马上开始':`${album?.owner||'朋友'} 的脑洞旅行`}</h2></div><span className="sync-status"><Users size={16}/>{ended?'放映结束':'正在一起看'}</span></div>
  <div className="sync-meta"><span>第 {albumIndex+1} / {albums.length} 条接龙</span><span>第 {step+1} / {room.total} 棒</span></div>
  <div className={`cinema-stage sync-stage ${showContent?'content-visible':''}`}>
   {waiting?<div className="sync-countdown"><span>游戏结束！准备一起揭晓</span><strong>{schedule?Math.max(1,Math.ceil((schedule.startsAt-now)/1000)):'…'}</strong><p>无需点击播放，所有人同步进入回放。</p></div>:<>
    <div className="sync-picture" style={{opacity:showContent?1:0}} aria-hidden={!showContent}>
     {entry?.skipped||!entry?<div className="cinema-text"><span>这一棒没赶上</span><p>下一位继续接住脑洞。</p></div>:entry.kind==='text'?<div className="cinema-text"><span>{step===0?'选择的词是':'猜成了'}</span><p>{entry.text?.slice(0,Math.max(1,Math.ceil((entry.text?.length||0)*Math.min(1,progress*3.5))))}</p></div>:recording?<canvas ref={canvas} width={recording.width||BOARD_WIDTH} height={recording.height||BOARD_HEIGHT} aria-label="全房间同步逐笔回放"/>:entry.replay&&!cached?<div className="image-loading">正在加载笔画，随后接上全房间进度…</div>:<div className="legacy-drawing"><DrawingImage entry={entry} code={room.code} token={token}/>{cached?.failed&&<p className="muted">笔画暂时不可用，展示完成的画作。</p>}</div>}
    </div>
    <div className="replay-person" style={{left:`calc(${50*(1-dock)}% + ${14*dock}px)`,top:`calc(${50*(1-dock)}% + ${12*dock}px)`,transform:`translate(${-50*(1-dock)}%,${-50*(1-dock)}%)`,gap:18-8*dock,padding:18-10*dock}}>
     <span className={`avatar avatar-${Math.max(0,playerIndex)%6}`} style={{width:82-44*dock,height:82-44*dock,fontSize:34-17*dock,borderRadius:25-13*dock}}>{player?.name.slice(0,1)||'?'}</span><div><strong style={{fontSize:25-11*dock}}>{player?.name||'朋友'}</strong><p style={{opacity:1-dock,maxHeight:28*(1-dock)}}>{introLabel}</p></div>
    </div>
   </>}
  </div>
  <div className="cinema-progress" role="progressbar" aria-label="全房间回放进度" aria-valuenow={Math.round(schedule?Math.max(0,Math.min(1,(now-schedule.startsAt)/(schedule.endsAt-schedule.startsAt)))*100:0)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${schedule?Math.max(0,Math.min(1,(now-schedule.startsAt)/(schedule.endsAt-schedule.startsAt)))*100:0}%`}}/></div>
  <div className="sync-footer"><p className="muted">{ended?'全部接龙已播放完毕，可以开始下一局了。':'自动同步播放 · 刷新后会接上大家的进度'}</p><button className="text-button" aria-pressed={sound&&ready} onClick={()=>{unlockSound();if(!ready)setSound(true);else setSound(v=>!v)}}>{sound&&ready?<Volume2 size={18}/>:<VolumeX size={18}/>} {!ready?'开启音效':sound?'音效开':'音效关'}</button></div>
  <div className="cinema-steps sync-steps" aria-label="本条接龙的玩家顺序">{album?.entries.map((e,i)=><div className={i===step?'active':''} key={i} aria-current={i===step?'step':undefined}><span>{i+1}</span>{room.players.find(p=>p.id===e?.author)?.name}<small>{i===0?'选词':e?.kind==='draw'?'画画':'猜词'}</small></div>)}</div>
  <div className="reveal-actions"><span className="tag">{ended?'这一局，圆满跑偏。':'大家一起看到最后'}</span>{isHost&&<button className="secondary next-game" disabled={busy||!ended} onClick={onRestart}>{ended?'再来一局':'回放结束后可开始下一局'}<Shuffle size={18}/></button>}</div>
 </section>
}
