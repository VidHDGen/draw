import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {root} from './runtime-env.mjs';
import path from 'node:path';
const configPath=path.join(root,'wrangler.jsonc');
const read=()=>JSON.parse(readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
const mode=process.argv[2];
const wrangler=path.join(root,'node_modules/wrangler/bin/wrangler.js');
function run(args){const r=spawnSync(process.execPath,args,{stdio:'inherit',cwd:root});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1)}
if(mode==='configure'){
  const c=read();
  if(process.env.CLOUDFLARE_D1_DATABASE_ID){if(!/^[a-f0-9-]{36}$/i.test(process.env.CLOUDFLARE_D1_DATABASE_ID))throw Error('Invalid CLOUDFLARE_D1_DATABASE_ID');c.d1_databases[0].database_id=process.env.CLOUDFLARE_D1_DATABASE_ID}
  if(process.env.CLOUDFLARE_R2_BUCKET_NAME){if(!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(process.env.CLOUDFLARE_R2_BUCKET_NAME))throw Error('Invalid CLOUDFLARE_R2_BUCKET_NAME');c.r2_buckets[0].bucket_name=process.env.CLOUDFLARE_R2_BUCKET_NAME}
  writeFileSync(configPath,JSON.stringify(c,null,2)+'\n');console.log('Cloudflare bindings configured. No credentials were written.');
}else if(mode==='migrate-local'){
  run([wrangler,'d1','migrations','apply','DB','--local','--config','wrangler.jsonc','--persist-to','.wrangler/state']);
}else if(mode==='deploy'){
  const c=read();if(c.d1_databases[0].database_id==='00000000-0000-4000-8000-000000000000')throw Error('Create your own D1 database and configure its ID before deployment. See README.md.');
  run(['scripts/framework.mjs','build']);
  run([wrangler,'d1','migrations','apply','DB','--remote','--config','wrangler.jsonc']);
  if(!existsSync(path.join(root,'dist/server/wrangler.json')))throw Error('Missing production Worker build');
  run([wrangler,'deploy','--config','dist/server/wrangler.json']);
}else if(mode==='preview'){
  run([wrangler,'dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--inspector-port','0',...process.argv.slice(3)]);
}else throw Error('Expected configure, migrate-local, deploy, or preview');
