import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Feedback } from '../components/Feedback';
import { requireSupabase } from '../lib/supabase/client';
import { errorMessage } from '../lib/utils';
export default function Login() {
  const navigate=useNavigate();
  const [signup,setSignup]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent) { e.preventDefault();setBusy(true);setError('');setMessage('');
    try {
      const sb=requireSupabase();
      if(signup) {
        const {data,error}=await sb.auth.signUp({ email,password,options:{ data:{display_name:name} } }); if(error) throw error;
        if(!data.session) {setMessage('Account created. Confirm your email before logging in (if email confirmation is enabled).');return;}
      } else { const {error}=await sb.auth.signInWithPassword({email,password});if(error) throw error; }
      navigate('/'); location.reload();
    } catch(e) {setError(errorMessage(e));} finally {setBusy(false);}
  }
  return <div className="mx-auto max-w-lg py-10"><Card className="p-8 md:p-10"><p className="mb-3 text-xs font-bold uppercase tracking-widest text-teal-700">DID-CHAIN ACCOUNT</p><CardTitle>{signup?'Create your student account':'Welcome back'}</CardTitle><p className="mt-3 text-sm leading-6 text-slate-500">University issuers must be approved by an administrator. Sign-up never grants university permissions.</p>
    <form onSubmit={submit} className="mt-7 space-y-4">{signup&&<label className="block text-sm font-semibold">Name<input required value={name} onChange={e=>setName(e.target.value)} className="field mt-2" placeholder="Your full name" /></label>}
      <label className="block text-sm font-semibold">Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="field mt-2" placeholder="name@example.com"/></label>
      <label className="block text-sm font-semibold">Password<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} className="field mt-2" placeholder="Password"/></label>
      <Button disabled={busy} className="w-full" type="submit">{busy?'Authenticating…':signup?'Create student account':'Sign in'}</Button>
    </form><Feedback kind="error" message={error}/><Feedback kind="success" message={message}/><button className="mt-6 text-sm font-semibold text-teal-700 underline" onClick={()=>{setSignup(!signup);setError('');setMessage('');}}>{signup?'Already registered? Sign in':'New student? Create an account'}</button><div className="mt-6 border-t pt-5 text-sm"><Link className="font-semibold text-slate-500 hover:text-teal-700" to="/verify">Verify a certificate without logging in →</Link></div>
  </Card></div>;
}
