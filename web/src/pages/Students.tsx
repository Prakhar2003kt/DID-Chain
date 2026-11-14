import { useEffect, useState } from 'react';
import { Card, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Feedback } from '../components/Feedback';
import { requireSupabase, ownProfile, type StudentRecord } from '../lib/supabase/client';
import { errorMessage, short } from '../lib/utils';
import { pdfSha256 } from '../lib/crypto/hashing';
import { toB64 } from '../lib/crypto/encryption';
export default function Students() {
  const [list,setList]=useState<StudentRecord[]>([]),[ref,setRef]=useState(''),[name,setName]=useState(''),[newCode,setNewCode]=useState(''),[recordId,setRecordId]=useState(''),[msg,setMsg]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function load(){try{const {data,error}=await requireSupabase().from('student_records').select('*').order('created_at',{ascending:false});if(error)throw error;setList(data as StudentRecord[]);}catch(e){setError(errorMessage(e));}}
  useEffect(()=>{void load();},[]);
  async function create(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNewCode('');try{
    const profile=await ownProfile();if(!profile.university_id)throw new Error('Institution not assigned');
    const code=toB64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    const hash=await pdfSha256(new TextEncoder().encode(code));
    const {data,error}=await requireSupabase().from('student_records').insert({
      university_id: profile.university_id,student_reference:ref.trim(),student_name:name.trim(),
      claim_code_hash:hash.slice(2),claim_code_expiry:new Date(Date.now()+7*24*60*60*1000).toISOString()
    }).select('id').single();
    if(error)throw error;setRecordId(data.id);setNewCode(code);setMsg('Record created. Share the code directly and securely with the intended student. Code is shown only now.');setRef('');setName('');await load();
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
  return <><div className="mb-8"><h1 className="text-3xl font-extrabold">Student record management</h1><p className="mt-2 text-slate-500">Create eligible students and securely share one-time enrollment codes.</p></div>
    <div className="grid gap-7 lg:grid-cols-[.9fr_1.1fr]"><Card><CardTitle>Add eligible student</CardTitle><form onSubmit={create} className="mt-6 space-y-4"><label className="block text-sm font-bold">Student reference<input className="field mt-2" required value={ref} onChange={e=>setRef(e.target.value)} placeholder="STU-1001"/></label><label className="block text-sm font-bold">Student name<input className="field mt-2" required value={name} onChange={e=>setName(e.target.value)} placeholder="Full legal name"/></label><Button disabled={busy}>{busy?'Saving…':'Create student record'}</Button></form>
      <Feedback kind="error" message={error}/><Feedback kind="success" message={msg}/>{newCode&&<div className="mt-4 rounded-xl bg-slate-100 p-4"><p className="text-xs font-bold">Record UUID</p><code className="mt-1 block break-all text-xs">{recordId}</code><p className="mt-3 text-xs font-bold">Single-use claim code</p><code className="mt-1 block break-all text-xs">{newCode}</code><Button className="mt-4" size="sm" variant="outline" type="button" onClick={()=>void navigator.clipboard.writeText(`Student record: ${recordId}\nEnrollment code: ${newCode}`)}>Copy enrollment details</Button></div>}
    </Card><Card><CardTitle>Current student records</CardTitle><div className="mt-5 space-y-3">{list.length===0?<p className="text-sm text-slate-500">No student records yet.</p>:list.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><strong>{s.student_name}</strong><p className="text-xs text-slate-500">{s.student_reference} · {short(s.id)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.claimed_by?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{s.claimed_by?'Claimed':'Awaiting claim'}</span></div>)}</div></Card></div>
  </>;
}
