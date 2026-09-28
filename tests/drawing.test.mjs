import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRecording,drawingState,replayStrokes,actionUnits} from '../lib/drawing.ts';
const pen={type:'stroke',stroke:{color:'#2548f4',width:6,points:[{x:0,y:10},{x:25,y:30},{x:80,y:50}]}};
test('portrait drawings preserve lower-canvas strokes and validate their own dimensions',()=>{
 const actions=[{...pen,stroke:{...pen.stroke,points:[{x:300,y:799}]}}];
 const portrait=validateRecording({version:1,width:600,height:800,actions});
 assert.equal(portrait.height,800);assert.equal(replayStrokes(portrait.actions,100)[0].points[0].y,799);
 assert.throws(()=>validateRecording({version:1,actions}));
 for(const width of [0,-1,1601,1.5,Infinity])assert.throws(()=>validateRecording({version:1,width,height:800,actions}));
 assert.throws(()=>validateRecording({version:1,width:600,height:600,actions}));
});
test('replay preserves erasing, undo, redo and reversible clear',()=>{
 const eraser={type:'stroke',stroke:{...pen.stroke,color:'#ffffff',width:24}};
 const actions=[pen,eraser,{type:'undo'},{type:'redo'},{type:'clear'},{type:'undo'}];
 const rec=validateRecording({version:1,actions});
 assert.deepEqual(drawingState(rec.actions).strokes,[pen.stroke,eraser.stroke]);
 assert.deepEqual(replayStrokes(actions,actions.reduce((n,a)=>n+actionUnits(a),0)),[pen.stroke,eraser.stroke]);
 assert.equal(replayStrokes([pen],1)[0].points.length,1);
 assert.deepEqual(replayStrokes([pen],0),[]);
});
test('reject malformed or oversized replay data before storage',()=>{
 for(const stroke of [{...pen.stroke,color:'url(evil)'},{...pen.stroke,width:Infinity},{...pen.stroke,points:[{x:-1,y:1}]},{...pen.stroke,points:[{x:1,y:NaN}]},{...pen.stroke,points:Array(30001).fill({x:1,y:1})}]){
  assert.throws(()=>validateRecording({version:1,actions:[{type:'stroke',stroke}]}));
 }
 assert.throws(()=>validateRecording({version:1,actions:Array(2001).fill({type:'clear'})}));
 assert.throws(()=>validateRecording({version:1,actions:[{type:'eval'}]}));
});
