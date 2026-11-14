import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Feedback } from '../components/Feedback';
import { requireSupabase, ownProfile, type StudentRecord, type University } from '../lib/supabase/client';
import { issueCertificate } from '../lib/supabase/issuance';
import { errorMessage, short } from '../lib/utils';
export default function Issue() {
  const [students,setStudents]=useState<StudentRecord[]>([]),[uni,setUni]=useState<University|null>(null),[chosen,setChosen]=useState(''),[qualification,setQualification]=useState('Master of Applied Cybersecurity'),[expiry,setExpiry]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState('');
  useEffect(()=>{(async()=>{try{const p=await ownProfile();const sb=requireSupabase();const [{data:u,error:e},{data:s,error:se}]=await Promise.all([sb.from('universities').select('*').eq('id',p.university_id).single(),sb.from('student_records').select('*').not('claimed_by','is',null)]);if(e||se)throw e||se;setUni(u as University);setStudents(s as StudentRecord[]);}catch(e){setError(errorMessage(e));}})();},[]);
  async function issue(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSuccess('');setProgress('Checking institution and student identity');try{
    const s=students.find(x=>x.id===chosen);if(!s||!uni)throw new Error('Select a claimed student record');
    const validExpiry=expiry?Math.floor(new Date(`${expiry}T23:59:59`).getTime()/1000):0;
    const result=await issueCertificate(s,uni,qualification.trim(),validExpiry,setProgress);
    setSuccess(`Credential ${short(result.certId)} issued, anchored and encrypted for the holder. Transaction ${short(result.transactionHash)}`);
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
  return <div className="mx-auto max-w-3xl"><div className="mb-7"><p className="text-xs font-bold tracking-widest text-teal-700">DIGITAL SIGNATURE → BLOCKCHAIN → ENCRYPTED DELIVERY</p><h1 className="mt-2 text-3xl font-extrabold">Issue academic certificate</h1><p className="mt-2 text-slate-500">The final PDF is created, frozen, SHA-256 hashed and signed by the authorized university wallet.</p></div>
    <Card><CardTitle>New university credential</CardTitle><form onSubmit={issue} className="mt-6 space-y-5"><label className="block text-sm font-bold">Eligible claimed student<select className="field mt-2" required value={chosen} onChange={e=>setChosen(e.target.value)}><option value="">Choose student</option>{students.map(s=><option value={s.id} key={s.id}>{s.student_name} ({s.student_reference})</option>)}</select></label>
      <label className="block text-sm font-bold">Awarded qualification<input className="field mt-2" required minLength={3} maxLength={100} value={qualification} onChange={e=>setQualification(e.target.value)}/></label>
      <label className="block text-sm font-bold">Expiry date (optional)<input className="field mt-2" type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
      <div className="rounded-xl bg-teal-50 p-4 text-sm leading-6 text-teal-900">This action requests two real MetaMask confirmations: the EIP-712 credential signature and an on-chain registration transaction. An interrupted transaction may require reconciliation from Credential History.</div>
      <Button disabled={busy||!uni||!chosen}>{busy?'Working — see status below':'Sign, register and deliver certificate'}</Button>
    </form><Feedback message={progress}/><Feedback message={error} kind="error"/><Feedback message={success} kind="success"/><Link className="mt-6 inline-block text-sm font-bold text-teal-700" to="/university/history">View credential history and recovery →</Link></Card>
  </div>;
}
