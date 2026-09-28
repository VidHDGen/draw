"use client";
import {useEffect,useState} from 'react';
import type {Entry} from '@/lib/game';
export function DrawingImage({entry,code,token}:{entry:Entry;code:string;token:string}){
 const [src,setSrc]=useState(''),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true,blobUrl='';const controller=new AbortController();setSrc('');setFailed(false);fetch(`/api/drawing?code=${code}&key=${encodeURIComponent(entry.image||'')}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();blobUrl=URL.createObjectURL(await r.blob());if(live)setSrc(blobUrl);else URL.revokeObjectURL(blobUrl)}).catch(e=>{if(live&&e.name!=='AbortError')setFailed(true)});return()=>{live=false;controller.abort();if(blobUrl)URL.revokeObjectURL(blobUrl)}},[entry.image,code,token,attempt]);
 return src?<img className="received-drawing" src={src} alt="上一位朋友的画作"/>:<div className="image-loading">{failed?<button className="secondary" onClick={()=>setAttempt(a=>a+1)}>画作加载失败，点击重试</button>:'正在打开画作…'}</div>
}
