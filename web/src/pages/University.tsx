import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, FileCheck2, GraduationCap, ShieldX, Wallet, type LucideIcon } from 'lucide-react';
import { Card, CardTitle } from '../components/ui/card';
import { Feedback } from '../components/Feedback';
import { requireSupabase, ownProfile, type University } from '../lib/supabase/client';
import { errorMessage, short } from '../lib/utils';
import { issuerAuthorized } from '../lib/blockchain/registry';
import { pkh } from '../lib/crypto/eip712';
export default function University() {
  const [uni,setUni]=useState<University|null>(null),[count,setCount]=useState(0),[revoked,setRevoked]=useState(0),[students,setStudents]=useState(0),[approved,setApproved]=useState<boolean|null>(null),[error,setError]=useState('');
  useEffect(()=>{(async()=>{try{
    const p=await ownProfile();const sb=requireSupabase();
    const [{data:u,error:e},{count:credentialCount},{count:revokedCount},{count:studentCount}]=await Promise.all([
      sb.from('universities').select('*').eq('id',p.university_id).single(),
      sb.from('credentials').select('*',{count:'exact',head:true}),
      sb.from('credentials').select('*',{count:'exact',head:true}).eq('issuance_state','revoked'),
      sb.from('student_records').select('*',{count:'exact',head:true})
    ]);
    if(e||!u) throw new Error(e?.message||'University not accessible');setUni(u);setCount(credentialCount||0);setRevoked(revokedCount||0);setStudents(studentCount||0);
    try{setApproved(await issuerAuthorized(u.issuer_wallet));}catch{setApproved(null);}
  }catch(e){setError(errorMessage(e));}})();},[]);
  const stats: {icon:LucideIcon;title:string;value:number}[] = [{icon:FileCheck2,title:'Credentials issued',value:count},{icon:GraduationCap,title:'Student records',value:students},{icon:ShieldX,title:'Recorded revocations',value:revoked}];
  return <><div className="mb-9"><p className="text-xs font-bold uppercase tracking-widest text-teal-700">ISSUER CONTROL CENTER</p><h1 className="mt-2 text-3xl font-extrabold md:text-4xl">University dashboard</h1><p className="mt-2 text-slate-500">Manage academic records, securely issue signed credentials and control revocations.</p></div>
    <Feedback message={error} kind="error"/>
    <div className="mb-7 grid gap-4 sm:grid-cols-3">{stats.map(({icon:Icon,title,value})=><Card key={title} className="flex items-center gap-4"><span className="rounded-2xl bg-slate-100 p-3 text-teal-700"><Icon size={24}/></span><div><p className="text-sm text-slate-500">{title}</p><p className="text-3xl font-extrabold">{value}</p></div></Card>)}</div>
    <div className="grid gap-6 md:grid-cols-2"><Card><div className="flex gap-3"><Building2 className="text-teal-700" size={26}/><CardTitle>{uni?.name||'Loading institution…'}</CardTitle></div><p className="mt-4 text-sm text-slate-500">Approved by administrator: <strong className="text-slate-800">{uni ? uni.approved?'Yes':'No':'—'}</strong></p><p className="mt-3 text-sm text-slate-500">Issuer wallet: <code className="text-slate-700">{short(uni?.issuer_wallet)}</code></p>{uni&&<p className="mt-2 break-all font-mono text-xs text-slate-500">Issuer DID: {pkh(uni.issuer_wallet)}</p>}<p className="mt-3 text-sm text-slate-500">Blockchain authorization: <strong className={approved?'text-emerald-700':'text-rose-700'}>{approved===null?'Unavailable':approved?'Active':'Not authorized'}</strong></p><Link className="mt-7 inline-flex items-center gap-2 font-bold text-teal-700" to="/university/students">Manage enrolled students <ArrowRight size={18}/></Link></Card>
      <Card><div className="flex gap-3"><Wallet className="text-teal-700" size={26}/><CardTitle>Credential operations</CardTitle></div><p className="mt-4 text-sm leading-7 text-slate-600">Only an administrator-approved university account using its authorized issuer wallet can sign and anchor new academic credentials.</p><div className="mt-6 flex flex-wrap gap-4"><Link to="/university/issue" className="rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-slate-950">Issue certificate</Link><Link to="/university/history" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">History & revocation</Link></div></Card></div>
  </>;
}
