import { createClient } from 'npm:@supabase/supabase-js@2';

const origin = Deno.env.get('PUBLIC_APP_ORIGIN') || 'http://127.0.0.1:5173';
const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type,apikey,authorization', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Vary': 'Origin' };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' },405);
  if (Number(req.headers.get('content-length') || 0) > 2048) return json({ error: 'Oversize request' },413);
  try {
    const body = await req.json();
    if (!body || typeof body.pdfSha256 !== 'string' || !/^0x[0-9a-f]{64}$/.test(body.pdfSha256)) return json({ error: 'Invalid PDF SHA-256 fingerprint' },400);
    const { data: credential, error } = await supabase.from('credentials').select('university_id,signed_credential_data,issuer_signature,issuance_state,transaction_hash')
      .eq('pdf_sha256',body.pdfSha256).maybeSingle();
    if (error) return json({ error: 'Evidence service failure' },503);
    if (!credential) return json({ error: 'No matching credential proof' },404);
    if (credential.issuance_state === 'pending') return json({ error: 'Issuance awaiting reconciliation' },409);
    const { data: uni, error: uniError } = await supabase.from('universities').select('name,issuer_wallet,approved').eq('id',credential.university_id).single();
    if (uniError || !uni) return json({ error: 'University record unavailable' },503);
    // The proof returned here is not presumed valid. Browser independently verifies cryptographic & on-chain evidence.
    return json({ credential: credential.signed_credential_data, issuerSignature: credential.issuer_signature,
      institutionWallet: uni.issuer_wallet, institutionApproved: uni.approved, institutionName: uni.name,
      transactionHash: credential.transaction_hash });
  } catch { return json({ error: 'Malformed request' },400); }
});
