// HIGH-RISK OPERATION. Explicit demo scope and user confirmation required.
import { createClient } from '@supabase/supabase-js';
const id=process.env.DIDCHAIN_DEMO_UNIVERSITY_ID;
if(process.argv[2]!=='--confirm-demo-reset' || !id || !/^[0-9a-f-]{36}$/i.test(id)){
 console.error('REFUSED. Supply DIDCHAIN_DEMO_UNIVERSITY_ID and --confirm-demo-reset. See demo/demo-setup.md.');process.exit(2);
}
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in this process environment. Never paste keys into web/.env.');process.exit(2);}
const admin=createClient(url,key,{auth:{persistSession:false}});
const {data:uni,error:uniError}=await admin.from('universities').select('id,name,is_demo').eq('id',id).single();
if(uniError||!uni?.is_demo){console.error('REFUSED: selected institution does not exist or is not marked is_demo=true');process.exit(2);}
const {data:rows,error}=await admin.from('credentials').select('cert_id,pdf_storage_path,encrypted_package_path,is_demo').eq('university_id',id);
if(error)throw error;
if(rows.some(r=>!r.is_demo)){console.error('REFUSED: institution contains non-demo credentials. Use a disposable demo Supabase project.');process.exit(2);}
console.log(`Resetting ONLY ${rows.length} demo credential rows for university ${uni.name}. Student accounts and records remain.`);
for(const row of rows) {
 if(row.encrypted_package_path){const {error:e}=await admin.storage.from('didchain-packages').remove([row.encrypted_package_path]);if(e)throw e;}
 if(row.pdf_storage_path){const {error:e}=await admin.storage.from('didchain-pdfs').remove([row.pdf_storage_path]);if(e)throw e;}
}
const {error:del}=await admin.from('credentials').delete().eq('university_id',id).eq('is_demo',true);
if(del)throw del;
console.log('Demo proof records and stored packages cleared. Restart local Hardhat node and redeploy BEFORE issuing new certificates.');
