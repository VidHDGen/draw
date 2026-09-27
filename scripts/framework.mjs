import './runtime-env.mjs';
import {fileURLToPath} from 'node:url';
const [command,...args]=process.argv.slice(2);
if(!['dev','build'].includes(command))throw Error('Expected dev or build');
const cli=new URL('../node_modules/vinext/dist/cli.js',import.meta.url);
process.argv=[process.execPath,fileURLToPath(cli),command,...args];
await import(cli.href);
