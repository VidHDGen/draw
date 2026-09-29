import type {Recording} from './drawing.ts';

// Keep the round open briefly for the final image upload after the drawing clock stops.
export const DRAWING_UPLOAD_GRACE_MS=10000;
export type DrawingSnapshot={image:string;recording:Recording};
export type DeliveryStatus='saved'|'saving'|'retrying'|'submitting';

export class DrawingDelivery {
  private stopped=false;
  private saving=false;
  private submitting=false;
  private savedRevision=-1;
  private saveAfter=0;
  private submitAfter=0;
  private final:DrawingSnapshot|null=null;
  constructor(private options:{
    deadline:number;
    now:()=>number;
    revision:()=>number;
    snapshot:(freeze:boolean)=>DrawingSnapshot|null;
    send:(action:'draft'|'submit',snapshot:DrawingSnapshot)=>Promise<void>;
    status:(status:DeliveryStatus)=>void;
  }){}
  stop(){this.stopped=true}
  async tick(){
    const o=this.options,now=o.now();
    if(this.stopped)return;
    if(now>=o.deadline){
      // Do not let a slow background save block the deadline submission.
      if(this.submitting||now<this.submitAfter)return;
      this.final??=o.snapshot(true);
      if(!this.final||now>=o.deadline+DRAWING_UPLOAD_GRACE_MS)return;
      this.submitting=true;o.status('submitting');
      try{await o.send('submit',this.final);this.stopped=true}
      catch{if(!this.stopped){o.status('retrying');this.submitAfter=o.now()+1000}}
      finally{this.submitting=false}
      return;
    }
    if(this.saving||now<this.saveAfter||o.revision()===this.savedRevision)return;
    const revision=o.revision(),snapshot=o.snapshot(false);
    if(!snapshot)return;
    this.saving=true;this.saveAfter=now+4000;o.status('saving');
    try{await o.send('draft',snapshot);this.savedRevision=revision;if(!this.stopped&&!this.final)o.status('saved')}
    catch{if(!this.stopped&&!this.final)o.status('retrying')}
    finally{this.saving=false}
  }
}
