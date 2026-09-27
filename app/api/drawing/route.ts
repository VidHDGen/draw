import { GameError, view } from '@/lib/game';
import { bucket, readRoom, secretFrom } from '@/lib/room-store';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
  const url=new URL(request.url),code=url.searchParams.get('code')||'',key=url.searchParams.get('key');
  const {room,version}=await readRoom(code),secret=await secretFrom(request),state=view(room,secret,version);
  const allowed=state.previous?.image===key || state.albums?.some(a=>a.entries.some(e=>e?.image===key));
  if(!key||!allowed)throw new GameError('这幅画还不能查看。',403);
  const object=await bucket().get(key);if(!object)throw new GameError('画作暂时不可用。',404);
  return new Response(object.body,{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
}catch(e){return Response.json({error:e instanceof GameError?e.message:'画作加载失败，请重试。'},{status:e instanceof GameError?e.status:503})}}
