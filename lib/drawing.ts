export const BOARD_WIDTH=960, BOARD_HEIGHT=600;
export type Point={x:number;y:number};
export type Stroke={color:string;width:number;points:Point[];clear?:boolean};
export type DrawAction={type:'stroke';stroke:Stroke}|{type:'undo'|'redo'|'clear'};
export type Recording={version:1;actions:DrawAction[];width?:number;height?:number};
export const MAX_POINTS=30000, MAX_ACTIONS=2000;

export function validateRecording(value:unknown):Recording {
  if(!value||typeof value!=='object'||(value as Recording).version!==1)throw Error('画作回放格式错误。');
  const input=(value as Recording).actions;
  const {width=BOARD_WIDTH,height=BOARD_HEIGHT}=value as Recording;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1600||height>1200)throw Error('画布尺寸错误。');
  if(!Array.isArray(input)||input.length>MAX_ACTIONS)throw Error('画作笔画过多，请适当简化。');
  let count=0;
  const actions:DrawAction[]=input.map(a=>{
    if(!a||typeof a!=='object')throw Error('画作回放格式错误。');
    if(a.type==='undo'||a.type==='redo'||a.type==='clear')return {type:a.type};
    if(a.type!=='stroke'||!a.stroke)throw Error('画作回放格式错误。');
    const s=a.stroke;
    if(!/^#[0-9a-f]{6}$/i.test(s.color)||!Number.isFinite(s.width)||s.width<1||s.width>100||!Array.isArray(s.points)||!s.points.length)throw Error('画笔数据错误。');
    count+=s.points.length;if(count>MAX_POINTS)throw Error('画作笔画过多，请适当简化。');
    const points=s.points.map(p=>{
      if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>width||p.y<0||p.y>height)throw Error('画笔坐标错误。');
      return {x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10};
    });
    return {type:'stroke',stroke:{color:s.color,width:s.width,points}};
  });
  return {version:1,actions,...(('width' in value||'height' in value)?{width,height}:{})};
}
export function applyAction(strokes:Stroke[],redo:Stroke[],action:DrawAction){
  if(action.type==='undo'){const s=strokes.pop();if(s)redo.push(s)}
  else if(action.type==='redo'){const s=redo.pop();if(s)strokes.push(s)}
  else {strokes.push(action.type==='stroke'?action.stroke:{clear:true,color:'#ffffff',width:1,points:[]});redo.length=0}
}
export function drawingState(actions:DrawAction[]){const strokes:Stroke[]=[],redo:Stroke[]=[];for(const a of actions)applyAction(strokes,redo,a);return {strokes,redo}}
export function paintStroke(ctx:CanvasRenderingContext2D,s:Stroke){
  if(s.clear){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);return}
  if(!s.points.length)return;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=s.width;ctx.strokeStyle=s.color;ctx.fillStyle=s.color;
  ctx.beginPath();s.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  if(s.points.length===1){ctx.beginPath();ctx.arc(s.points[0].x,s.points[0].y,s.width/2,0,Math.PI*2);ctx.fill()}
}
export function paintDrawing(ctx:CanvasRenderingContext2D,strokes:Stroke[]){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);for(const s of strokes)paintStroke(ctx,s)}
export function actionUnits(a:DrawAction){return a.type==='stroke'?Math.max(6,a.stroke.points.length):24}
export function replayStrokes(actions:DrawAction[],progress:number){
  const strokes:Stroke[]=[],redo:Stroke[]=[];let remaining=progress;
  for(const action of actions){const units=actionUnits(action);if(remaining>=units){applyAction(strokes,redo,action);remaining-=units;continue}
    if(action.type==='stroke'&&remaining>0)strokes.push({...action.stroke,points:action.stroke.points.slice(0,Math.max(1,Math.ceil(action.stroke.points.length*remaining/units)))});
    break;
  }return strokes;
}
