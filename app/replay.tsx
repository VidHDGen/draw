"use client";
import {useEffect,useRef,useState,useCallback} from 'react';
import {Play,Pause,RotateCcw,ChevronLeft,ChevronRight,Volume2,VolumeX,Shuffle} from 'lucide-react';
import {DrawingImage} from './drawing-image';
import {actionUnits,paintDrawing,replayStrokes,validateRecording,BOARD_WIDTH,BOARD_HEIGHT} from '@/lib/drawing';
import type {Recording} from '@/lib/drawing';
import type {view,Entry} from '@/lib/game';
type State=ReturnType<typeof view>;
function ReplayStage({entry,code,token,playing,speed,onComplete,onGuess}:{entry:Entry|null;code:string;token:string;playing:boolean;speed:number;onComplete:()=>void;onGuess:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),elapsed=useRef(0),finished=useRef(false),sounded=useRef(false);
 const [recording,setRecording]=useState<Recording|null>(null),[loaded,setLoaded]=useState(!entry?.replay),[failed,setFailed]=useState(false),[progress,setProgress]=useState(0);
 useEffect(()=>{if(!entry?.replay)return;const controller=new AbortController();fetch(`/api/drawing?code=${code}&key=${encodeURIComponent(entry.image||'')}&replay=1`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return validateRecording(await r.json())}).then(setRecording).catch(e=>{if(e.name!=='AbortError')setFailed(true)}).finally(()=>{if(!controller.signal.aborted)setLoaded(true)});return()=>controller.abort()},[entry?.image,entry?.replay,code,token]);
 const units=recording?.actions.reduce((n,a)=>n+actionUnits(a),0)||1;
 const duration=recording?Math.min(18000,Math.max(4000,units*8)):entry?.kind==='text'?3200:4000;
 useEffect(()=>{
  const ctx=canvas.current?.getContext('2d');if(ctx&&recording)paintDrawing(ctx,replayStrokes(recording.actions,units*progress));
 },[recording,progress,units]);
 useEffect(()=>{if(!playing||!loaded||finished.current)return;if(entry?.kind==='text'&&!entry.skipped&&!sounded.current){sounded.current=true;onGuess()}
  let frame=0,last=0;const tick=(now:number)=>{if(last)elapsed.current+=Math.min(now-last,100)*speed;last=now;const p=Math.min(1,elapsed.current/duration);setProgress(p);if(elapsed.current>=duration+(recording?1200:0)){finished.current=true;onComplete()}else frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[playing,loaded,speed,duration,recording,onComplete,onGuess,entry?.kind,entry?.skipped]);
 return <><div className="cinema-stage" aria-live="polite">
  {entry?.skipped||!entry?<div className="cinema-text"><span>这一棒没赶上</span><p>下一位继续接住脑洞。</p></div>:entry.kind==='text'?<div className="cinema-text"><span>{progress===0?'准备揭晓…':'TA 的答案是'}</span><p>{progress===0?'？':entry.text?.slice(0,Math.max(1,Math.ceil((entry.text?.length||0)*Math.min(1,progress*3.5))))}</p></div>:!loaded?<div className="image-loading">正在准备逐笔回放…</div>:recording?<canvas ref={canvas} width={BOARD_WIDTH} height={BOARD_HEIGHT} aria-label="正在逐笔回放这位玩家的画作"/>:<div className="legacy-drawing"><DrawingImage entry={entry} code={code} token={token}/><p className="muted">{failed?'笔画回放暂时加载失败，先看看完成的画作。':'这幅画没有笔画记录，展示完成的画作。'}</p></div>}
 </div><div className="cinema-progress" role="progressbar" aria-label="这一棒回放进度" aria-valuenow={Math.round(progress*100)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${progress*100}%`}}/></div></>
}
export function GameReplay({room,token,isHost,busy,onRestart}:{room:State;token:string;isHost:boolean;busy:boolean;onRestart:()=>void}){
 const albums=room.albums||[],total=albums.reduce((n,a)=>n+a.entries.length,0);
 const [index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[sound,setSound]=useState(true),[run,setRun]=useState(0),[ended,setEnded]=useState(false);
 const audio=useRef<AudioContext|null>(null);
 const albumIndex=Math.floor(index/room.total),step=index%room.total,album=albums[albumIndex],entry=album?.entries[step]||null;
 const player=room.players.find(p=>p.id===entry?.author);
 function unlockAudio(){try{if(!audio.current)audio.current=new AudioContext();void audio.current.resume().catch(()=>{})}catch{}}
 useEffect(()=>()=>{void audio.current?.close().catch(()=>{})},[]);
 const guessSound=useCallback(()=>{if(!sound||step===0||!audio.current)return;const ctx=audio.current;try{[440,660,880].forEach((frequency,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+i*.085;osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.085,start+.012);gain.gain.exponentialRampToValueAtTime(.001,start+.18);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.2)})}catch{}},[sound,step]);
 const next=useCallback(()=>{if(index+1<total)setIndex(i=>i+1);else{setPlaying(false);setEnded(true)}},[index,total]);
 function jump(nextIndex:number){unlockAudio();setIndex(nextIndex);setRun(r=>r+1);setEnded(false);setPlaying(true)}
 return <section className="card cinema"><div className="reveal-heading"><div><span className="eyebrow">接龙放映室 · 第 {albumIndex+1} / {albums.length} 条</span><h2>{album?.owner} 的脑洞旅行</h2></div><label className="album-picker">选择接龙<select aria-label="选择要回放的接龙" value={albumIndex} onChange={e=>jump(Number(e.target.value)*room.total)}>{albums.map((a,i)=><option value={i} key={i}>{i+1}. {a.owner}</option>)}</select></label></div>
  <div className="cinema-author"><span className={`avatar avatar-${step%6}`}>{player?.name.slice(0,1)||'?'}</span><div><strong>{player?.name||'朋友'}</strong><p>{step===0?'选中了这个开场词':entry?.kind==='draw'?'接过画笔，一笔一笔画成了…':'看着上一幅画，猜成了…'}</p></div><span className="tag">第 {step+1} / {room.total} 棒</span></div>
  <ReplayStage key={`${index}-${run}`} entry={entry} code={room.code} token={token} playing={playing} speed={speed} onComplete={next} onGuess={guessSound}/>
  <div className="cinema-controls"><button className="icon-button" aria-label="上一棒" disabled={index===0} onClick={()=>jump(index-1)}><ChevronLeft/></button><button className="primary" onClick={()=>{unlockAudio();if(ended)jump(0);else setPlaying(v=>!v)}}>{playing?<Pause size={18}/>:<Play size={18}/>} {ended?'再看一遍':playing?'暂停':'播放回放'}</button><button className="icon-button" aria-label="下一棒" disabled={index>=total-1} onClick={()=>jump(index+1)}><ChevronRight/></button><button className="text-button" onClick={()=>jump(albumIndex*room.total)}><RotateCcw size={16}/>重播这条</button><label className="speed-picker">速度<select aria-label="回放速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label><button className="text-button" aria-label={sound?'关闭猜词音效':'开启猜词音效'} aria-pressed={sound} onClick={()=>{unlockAudio();setSound(v=>!v)}}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}音效{sound?'开':'关'}</button></div>
  <div className="cinema-steps">{album?.entries.map((e,i)=><button className={i===step?'active':''} key={i} onClick={()=>jump(albumIndex*room.total+i)} aria-label={`回放第 ${i+1} 棒`} aria-current={i===step?'step':undefined}><span>{i+1}</span>{room.players.find(p=>p.id===e?.author)?.name}<small>{i===0?'选词':e?.kind==='draw'?'画画':'猜词'}</small></button>)}</div>
  <div className="reveal-actions"><p className="muted">{ended?'全部接龙已放映完毕。':'点击播放，从开场词一路看到最后；画笔、橡皮和撤销都会重现。'}</p>{isHost&&<button className="secondary next-game" disabled={busy} onClick={onRestart}>再来一局<Shuffle size={18}/></button>}</div>
 </section>
}
