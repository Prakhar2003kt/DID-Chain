import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
export function Feedback({message,kind='info'}:{message:string;kind?:'error'|'success'|'info'}) {
  if (!message) return null;
  return <div role="status" className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${kind==='error'?'border-rose-200 bg-rose-50 text-rose-800':kind==='success'?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-teal-200 bg-teal-50 text-teal-800'}`}>
    {kind==='error'?<AlertCircle className="mt-0.5 shrink-0" size={17}/>:kind==='success'?<CheckCircle2 className="mt-0.5 shrink-0" size={17}/>:<LoaderCircle className="mt-0.5 shrink-0" size={17}/>}<span>{message}</span>
  </div>;
}
