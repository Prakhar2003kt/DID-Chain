import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, FileCheck, LockKeyhole } from 'lucide-react';
import { Card, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Feedback } from '../components/Feedback';
import { requireSupabase, type Profile, type CredentialRow } from '../lib/supabase/client';
import { loadKey, decryptPackage, fromB64, type EncryptedPackage } from '../lib/crypto/encryption';
import { fromJSON, verifyIssuer } from '../lib/crypto/eip712';
import { verifyPDF } from '../lib/verification/verify';
import { connectWallet } from '../lib/blockchain/registry';
import { signOwnership, type HolderChallenge } from '../lib/crypto/ownership';
import { pkh } from '../lib/crypto/eip712';
import { errorMessage, short } from '../lib/utils';
export default function Student({profile}:{profile:Profile}) {
  const [rows,setRows]=useState<CredentialRow[]>([]),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(''),[originals,setOriginals]=useState<Record<string,Uint8Array>>({});
  const [ownershipInput,setOwnershipInput]=useState(''),[ownershipResponse,setOwnershipResponse]=useState('');
  useEffect(()=>{(async()=>{try{const {data,error}=await requireSupabase().from('credentials').select('*').order('created_at',{ascending:false});if(error)throw error;setRows(data as CredentialRow[]);}catch(e){setError(errorMessage(e));}})();},[]);
  async function open(row:CredentialRow){setBusy(row.cert_id);setError('');setSuccess('');try{
    if(!row.encrypted_package_path||!profile.wallet_address)throw new Error('Encrypted delivery or wallet not available');
    const key=await loadKey(profile.id);if(!key)throw new Error('Decryption key not found on this device. Check onboarding and browser storage.');
    const {data,error}=await requireSupabase().storage.from('didchain-packages').download(row.encrypted_package_path);
    if(error||!data)throw error||new Error('Private package not accessible');
    const pack=JSON.parse(await data.text()) as EncryptedPackage;
    const payload=await decryptPackage(pack,key,profile.wallet_address);
    if(!verifyIssuer(fromJSON(payload.credential),payload.issuerSignature))throw new Error('Issuer signature mismatch after decryption');
    const original=fromB64(payload.pdfBase64);
    const verdict=await verifyPDF(original);
    if(verdict.verdict==='INVALID')throw new Error('Decrypted credential failed independent verification');
    setOriginals(v=>({...v,[row.cert_id]:original}));
    setSuccess(verdict.verdict==='VERIFICATION UNAVAILABLE' ? 'PDF decrypted; original hash and issuer signature verified locally. Current on-chain validity is unavailable.' : `PDF decrypted and authenticated. Current blockchain verification: ${verdict.verdict}`);
  }catch(e){setError(errorMessage(e));}finally{setBusy('');}}
  function pdfBlob(original:Uint8Array) {return new Blob([Uint8Array.from(original).buffer as ArrayBuffer],{type:'application/pdf'});}
  function download(certId:string){const b=originals[certId];if(!b)return;const url=URL.createObjectURL(pdfBlob(b));const a=document.createElement('a');a.href=url;a.download=`DID-Chain_${certId.slice(2,12)}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function view(certId:string){const b=originals[certId];if(!b)return;const url=URL.createObjectURL(pdfBlob(b));window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000);}
  async function respondToChallenge(){setError('');setOwnershipResponse('');try{
    const c=JSON.parse(ownershipInput) as HolderChallenge;
    if(!c.certId||!c.id||!c.nonce||!c.context||!c.expiresAt||!c.expectedHolder)throw new Error('Incomplete challenge JSON');
    if(!rows.some(r=>r.cert_id===c.certId))throw new Error('This is not one of your credentials');
    if(Date.parse(c.expiresAt)<=Date.now())throw new Error('Challenge expired');
    const {signer,address}=await connectWallet();if(address.toLowerCase()!==c.expectedHolder.toLowerCase())throw new Error('Connect the wallet that owns the presented credential');
    const signature=await signOwnership(signer,c);const output=JSON.stringify({id:c.id,signature},null,2);setOwnershipResponse(output);setSuccess('Challenge signed by linked student wallet. Return the response JSON to the verifier.');
  }catch(e){setError(errorMessage(e));}}
  return <><div className="mb-8"><p className="text-xs font-bold tracking-widest text-teal-700">STUDENT VAULT</p><h1 className="mt-2 text-3xl font-extrabold">My academic credentials</h1><p className="mt-2 text-slate-500">Your certificates stay encrypted until decrypted with your local P-256 key.</p>{profile.wallet_address&&<p className="mt-3 break-all font-mono text-xs text-teal-700">Holder DID: {pkh(profile.wallet_address)}</p>}</div>
    {!profile.encryption_public_key&&<div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">Complete your <Link to="/student/onboarding" className="font-bold underline">wallet and encryption-key setup</Link> before receiving certificates.</div>}
    <div className="grid gap-4 md:grid-cols-2">{rows.length===0?<Card>No credentials yet. Your university must issue one after onboarding.</Card>:rows.map(r=><Card key={r.cert_id}><div className="flex items-start justify-between"><FileCheck className="text-teal-600" size={29}/><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{r.issuance_state.toUpperCase().replace('_',' ')}</span></div><CardTitle>{String((r.signed_credential_data as {qualification?:string}).qualification||'Academic credential')}</CardTitle><p className="mt-2 text-sm text-slate-500">{short(r.cert_id)}</p><p className="mt-1 text-xs text-slate-500">Issue date: {new Date(r.issue_date).toLocaleDateString()}</p><div className="mt-5 flex flex-wrap gap-2"><Button disabled={!!busy||!r.encrypted_package_path} onClick={()=>void open(r)}><LockKeyhole size={16}/>Decrypt & verify</Button>{originals[r.cert_id]&&<><Button size="sm" variant="outline" onClick={()=>download(r.cert_id)}><Download size={15}/>Download original</Button><Button size="sm" variant="subtle" onClick={()=>view(r.cert_id)}><ExternalLink size={15}/>View PDF</Button></>}</div></Card>)}</div>
    <Feedback message={error} kind="error"/><Feedback message={success} kind="success"/>
    <Card className="mt-8"><CardTitle>Respond to a holder-ownership challenge</CardTitle><p className="mt-2 text-sm leading-6 text-slate-500">The employer sends you a fresh challenge JSON. Only the wallet registered in your credential can sign it. This is separate from PDF authenticity.</p><textarea className="field mt-4 h-28 font-mono text-xs" placeholder="Paste the employer's challenge JSON" value={ownershipInput} onChange={e=>setOwnershipInput(e.target.value)}/><Button className="mt-3" variant="outline" disabled={!ownershipInput} onClick={()=>void respondToChallenge()}>Sign ownership challenge</Button>{ownershipResponse&&<div className="mt-5 rounded-xl bg-slate-100 p-4"><pre className="text-xs">{ownershipResponse}</pre><Button className="mt-3" size="sm" onClick={()=>void navigator.clipboard.writeText(ownershipResponse)}>Copy signed response</Button></div>}</Card>
  </>;
}
