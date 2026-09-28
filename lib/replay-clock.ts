export const REPLAY_LEAD_MS=5000, INTRO_MS=2400, DOCK_MS=650;
export type ReplayStep={album:number;step:number;startsAt:number;contentAt:number;drawMs:number;endsAt:number};
export type ReplaySchedule={startsAt:number;endsAt:number;steps:ReplayStep[]};
type ReplayEntry={kind:'text'|'draw';skipped?:boolean;replayMs?:number}|null;
export function makeReplaySchedule(entries:ReplayEntry[][],startsAt:number):ReplaySchedule{
 const steps:ReplayStep[]=[];let cursor=startsAt;const count=entries.length;
 for(let album=0;album<count;album++)for(let step=0;step<count;step++){
  const entry=entries[step]?.[(album+step)%count];
  const drawMs=entry?.skipped?2200:entry?.kind==='draw'?Math.max(4000,Math.min(18000,entry.replayMs||6000)):3200;
  const contentAt=cursor+INTRO_MS,endsAt=contentAt+drawMs+1200;
  steps.push({album,step,startsAt:cursor,contentAt,drawMs,endsAt});cursor=endsAt;
 }return {startsAt,endsAt:cursor,steps};
}
export function replayPosition(schedule:ReplaySchedule,now:number){
 const waiting=now<schedule.startsAt,ended=now>=schedule.endsAt;
 const index=ended?Math.max(0,schedule.steps.length-1):Math.max(0,schedule.steps.findIndex(s=>now<s.endsAt));
 const stage=schedule.steps[index];
 return {index,stage,waiting,ended,progress:stage?Math.max(0,Math.min(1,(now-stage.contentAt)/stage.drawMs)):0,introElapsed:stage?Math.max(0,now-stage.startsAt):0};
}
