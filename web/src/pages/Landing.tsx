import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Fingerprint, FileCheck2, GraduationCap, LockKeyhole, ShieldCheck, Wallet, type LucideIcon } from 'lucide-react';
export default function Landing() {
  const roles: {icon:LucideIcon;title:string;body:string}[] = [
    {icon:Building2,title:'University issuer',body:'Generate PDF certificates, sign them with an authorized MetaMask wallet, and register evidence on-chain.'},
    {icon:Wallet,title:'Student holder',body:'Claim your university record, link your wallet, decrypt credentials and share original PDF files.'},
    {icon:Fingerprint,title:'Employer verifier',body:'Upload the original PDF. Check the signature, issuing institution, on-chain registration and revocation.'}
  ];
  return <div>
    <div className="grid items-center gap-8 rounded-[2rem] bg-slate-950 px-7 py-14 text-white shadow-xl md:grid-cols-2 md:px-14 md:py-20">
      <div><span className="inline-flex items-center gap-2 rounded-full border border-teal-500/40 bg-teal-500/10 px-4 py-2 text-xs font-semibold tracking-wide text-teal-300"><ShieldCheck size={14}/> CRYPTOGRAPHICALLY VERIFIABLE ACADEMIC CREDENTIALS</span>
        <h1 className="mt-7 max-w-xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">Academic trust,<br/><span className="text-teal-300">verified.</span></h1>
        <p className="mt-6 max-w-lg text-base leading-8 text-slate-300">Universities sign. Students securely receive. Employers verify the original PDF against digital signatures and blockchain records — no employer account required.</p>
        <div className="mt-9 flex flex-wrap gap-3"><Link to="/verify" className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-teal-300">Verify a PDF <ArrowRight size={18}/></Link><Link to="/login" className="rounded-xl border border-slate-600 px-6 py-3.5 text-sm font-semibold hover:bg-white/10">University / Student login</Link></div>
      </div>
      <div className="relative mx-auto w-full max-w-md"><div className="rounded-3xl border border-white/15 bg-white/10 p-7 shadow-2xl backdrop-blur"><div className="mb-7 flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-bold"><GraduationCap className="text-teal-300"/> DID-Chain Certificate</span><ShieldCheck className="text-teal-300"/></div><p className="text-sm text-slate-400">Academic credential</p><p className="mt-2 text-2xl font-bold">Master of Cybersecurity</p><div className="my-6 h-px bg-white/15"/><div className="grid grid-cols-2 gap-5 text-xs"><span className="text-slate-400">Signature standard<br/><strong className="mt-1 inline-block text-white">EIP-712 / ECDSA</strong></span><span className="text-slate-400">Document integrity<br/><strong className="mt-1 inline-block text-white">SHA-256</strong></span><span className="text-slate-400">On-chain registry<br/><strong className="mt-1 inline-block text-white">Ethereum-compatible</strong></span><span className="text-slate-400">Private delivery<br/><strong className="mt-1 inline-block text-white">AES-256-GCM</strong></span></div><div className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-teal-400/15 p-4 text-sm font-bold text-teal-200"><FileCheck2 size={20}/> Independent verification</div></div></div>
    </div>
    <section className="mt-14"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.25em] text-teal-700">ONE SYSTEM, THREE ROLES</p><h2 className="mt-2 text-3xl font-extrabold">Secure every step of the credential journey</h2></div><div className="grid gap-5 md:grid-cols-3">
      {roles.map(({icon:Icon,title,body})=><div key={title} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><div className="mb-5 inline-flex rounded-2xl bg-teal-50 p-3 text-teal-700"><Icon size={26}/></div><h3 className="text-xl font-bold">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{body}</p></div>)}</div></section>
    <div className="mt-12 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600"><LockKeyhole size={20} className="text-teal-600"/><strong>Research prototype:</strong> Local Hardhat is a development chain, not a public production network. PDF authenticity is separate from holder identity proof.</div>
  </div>;
}
