import { useEffect, useState } from 'react';
import { Card, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Feedback } from '../components/Feedback';
import { requireSupabase, ownProfile, type CredentialRow, type University } from '../lib/supabase/client';
import { reconcileCredential, retryDelivery, revokeCertificate } from '../lib/supabase/issuance';
import { errorMessage, short } from '../lib/utils';
import { ensureNetwork, getRpc, getRegistry } from '../lib/blockchain/registry';
export default function History() {
  const [chainStates,setChainStates]=useState<Record<string,string>>({}),[rows,setRows]=useState<CredentialRow[]>([]),[uni,setUni]=useState<University|null>(null),[error,setError]=useState(''),[info,setInfo]=useState(''),[busy,setBusy]=useState('');
  async function load(){try{const p=await ownProfile();const [{data:u,error:e},{data:c,error:ce}]=await Promise.all([requireSupabase().from('universities').select('*').eq('id',p.university_id).single(),requireSupabase().from('credentials').select('*').order('created_at',{ascending:false})]);if(e||ce)throw e||ce;setUni(u as University);setRows(c as CredentialRow[]);
    try{const p=getRpc();await ensureNetwork(p);const reg=getRegistry(p);const states=await Promise.all((c as CredentialRow[]).map(async row=>{try{const r=await reg.getCredential(row.credential_digest);return [row.cert_id,r[0]==='0x0000000000000000000000000000000000000000'?'NOT REGISTERED':r[2]?'REVOKED ON-CHAIN':'ACTIVE ON-CHAIN'] as const;}catch{return [row.cert_id,'STATUS UNAVAILABLE'] as const;}}));setChainStates(Object.fromEntries(states));}
    catch{setChainStates(Object.fromEntries((c as CredentialRow[]).map(row=>[row.cert_id,'RPC OFFLINE'])));}}catch(e){setError(errorMessage(e));}}
  useEffect(()=>{void load();},[]);
  async function operation(row:CredentialRow,action:'reconcile'|'retry'|'revoke'){setBusy(row.cert_id);setError('');setInfo('');try{let result='';if(action==='reconcile')result=await reconcileCredential(row);if(action==='retry'){if(!uni)throw new Error('University missing');result=await retryDelivery(row,uni);}if(action==='revoke'){if(!window.confirm('Irreversibly revoke this registered credential on the blockchain?'))return;result=await revokeCertificate(row);}setInfo(result);await load();}catch(e){setError(errorMessage(e));}finally{setBusy('');}}
  return <><div className="mb-8"><h1 className="text-3xl font-extrabold">Issued credential history</h1><p className="mt-2 text-slate-500">Real issuance states. Pending transactions and failed delivery can be recovered; revocation is irreversible.</p></div>
    <Feedback message={error} kind="error"/><Feedback message={info} kind="success"/>
    <Card><CardTitle>Registry entries</CardTitle><div className="mt-5 space-y-4">{rows.length===0?<p className="text-slate-500">No credentials have been issued.</p>:rows.map(row=><div key={row.cert_id} className="rounded-xl border border-slate-200 p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{String((row.signed_credential_data as {qualification?:string}).qualification||'Academic credential')}</p><p className="mt-1 text-xs text-slate-500">{short(row.cert_id)} · {short(row.holder_wallet)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${row.issuance_state==='revoked'?'bg-rose-100 text-rose-700':row.issuance_state==='delivered'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-800'}`}>DB: {row.issuance_state.toUpperCase().replace('_',' ')}</span></div>
      <p className="mt-3 text-xs font-bold text-teal-800">Blockchain: {chainStates[row.cert_id]||'Checking…'}</p>
      <p className="mt-3 break-all text-xs text-slate-500">Digest: {row.credential_digest}</p><p className="mt-1 text-xs text-slate-500">Transaction: {row.transaction_hash?short(row.transaction_hash):'Not yet synchronized'}</p>
      <div className="mt-4 flex flex-wrap gap-2">{row.issuance_state==='pending'&&<Button size="sm" disabled={!!busy} onClick={()=>void operation(row,'reconcile')}>Reconcile on-chain registration</Button>}{['registered','delivery_failed'].includes(row.issuance_state)&&<Button size="sm" variant="outline" disabled={!!busy} onClick={()=>void operation(row,'retry')}>Retry encrypted delivery</Button>}{row.issuance_state!=='pending'&&row.issuance_state!=='revoked'&&<Button size="sm" variant="danger" disabled={!!busy} onClick={()=>void operation(row,'revoke')}>Revoke on blockchain</Button>}</div>
    </div>)}</div></Card>
  </>;
}
