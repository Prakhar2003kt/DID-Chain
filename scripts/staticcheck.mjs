import { readdir, readFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { resolve, join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let ts;
try {ts=createRequire(import.meta.url)('typescript');}
catch {
 try {const path=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();ts=createRequire(join(path,'typescript/package.json'))('typescript');}
 catch {console.error('TypeScript parser unavailable; install dependencies');process.exit(2);}
}
let count=0,fail=0;
async function walk(dir){
 for(const e of await readdir(dir,{withFileTypes:true})) {
  if(['node_modules','dist','artifacts','cache'].includes(e.name))continue;
  const path=join(dir,e.name);
  if(e.isDirectory())await walk(path);
  else if(['.ts','.tsx','.json'].includes(extname(path))) {
   count++;
   const source=await readFile(path,'utf8');
   if(extname(path)==='.json') {try{JSON.parse(source)}catch(err){console.error('BAD JSON',path,err.message);fail++;}}
   else {
    const syntax=extname(path)==='.tsx'?ts.ScriptKind.TSX:ts.ScriptKind.TS;
    const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,syntax);
    for(const problem of file.parseDiagnostics) {
      const loc=file.getLineAndCharacterOfPosition(problem.start||0);
      console.error(`${path}:${loc.line+1}:${loc.character+1}`,ts.flattenDiagnosticMessageText(problem.messageText,' '));fail++;
    }
   }
  }
 }
}
await walk(root);
for(const required of ['contracts/contracts/AcademicCredentialRegistry.sol','supabase/migrations/202611040001_initial.sql','web/src/lib/verification/verify.ts','web/src/pages/Verify.tsx']){
 try{await access(join(root,required));}catch{console.error('MISSING',required);fail++;}
}
console.log(`Source syntax parsed: ${count} TS/TSX/JSON files, ${fail} errors`);
console.log('This is a SYNTAX check, not typechecking, dependency installation, integration testing or Solidity compilation.');
if(fail)process.exit(1);
