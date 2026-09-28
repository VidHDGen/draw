let context:AudioContext|null=null;
export function unlockSound(){
 try{context??=new AudioContext();void context.resume().catch(()=>{})}catch{}
}
export function soundReady(){return context?.state==='running'}
export function playGuessSound(){
 if(!context||context.state!=='running')return;
 const ctx=context;
 try{[440,660,880].forEach((frequency,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+i*.085;osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.085,start+.012);gain.gain.exponentialRampToValueAtTime(.001,start+.18);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.2)})}catch{}
}
