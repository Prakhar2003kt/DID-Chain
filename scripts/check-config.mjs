import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const nodeMajor=Number(process.versions.node.split('.')[0]);
console.log('Node.js:', process.versions.node, nodeMajor>=22?'OK (check >=22.13.0)':'FAIL: requires >=22.13.0');
const env=resolve(root,'web/.env');
if(!existsSync(env)) console.log('BLOCKED: web/.env absent. See web/.env.example');
else {
 const txt=readFileSync(env,'utf8');
 for(const key of ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','VITE_LOCAL_RPC_URL'])
   console.log(key, new RegExp(`^${key}=.+`,'m').test(txt)?'SET (value hidden)':'MISSING');
}
const deploy=JSON.parse(readFileSync(resolve(root,'web/src/generated/deployment.json'),'utf8'));
console.log('Contract deployment:',deploy.address?'EXPORTED':'BLOCKED: deploy registry on running Hardhat node');
console.log('Dependencies:',existsSync(resolve(root,'node_modules'))?'node_modules exists':'NOT INSTALLED — run npm install');
// RPC request uses only Node built-in fetch; no production secrets.
try {
 const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}),signal:AbortSignal.timeout(2500)});
 const result=await r.json();console.log('Local Hardhat RPC:',result.result=== '0x7a69' ?'REACHABLE — chain 31337':`Unexpected chain: ${result.result}`);
 if(deploy.address) {
  const rr=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'eth_getCode',params:[deploy.address,'latest']}),signal:AbortSignal.timeout(2500)});
  const out=await rr.json();console.log('Deployed registry code:',out.result && out.result!=='0x'?'PRESENT':'MISSING — stale deployment/reset?');
 }
} catch {console.log('Local RPC: OFFLINE. Start npm run chain in another Terminal.');}
