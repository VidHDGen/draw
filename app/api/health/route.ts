import {database,bucket} from '@/lib/room-store';
export const dynamic='force-dynamic';
export async function GET(){try{await Promise.all([database().prepare('SELECT 1 AS ok').first(),bucket().head('__healthcheck__')]);return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}}
