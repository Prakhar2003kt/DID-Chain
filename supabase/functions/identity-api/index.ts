import { createClient } from 'npm:@supabase/supabase-js@2';
import { getAddress, verifyMessage } from 'npm:ethers@6';

const allowedOrigin = Deno.env.get('PUBLIC_APP_ORIGIN') || 'http://127.0.0.1:5173';
const cors = { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Vary': 'Origin' };
const reply = (data: unknown, status=200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const freshNonce = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), v => v.toString(16).padStart(2, '0')).join('');
const isHex = (s: unknown) => typeof s === 'string' && /^0x[0-9a-f]{64}$/.test(s);
const walletMessage = (userId: string, wallet: string, nonce: string) => `DID-Chain Wallet Link\nUser: ${userId}\nWallet: ${getAddress(wallet)}\nChallenge: ${nonce}`;
const encryptionMessage = (userId: string, wallet: string, key: JsonWebKey, nonce: string) =>
  `DID-Chain Encryption Key Binding\nUser: ${userId}\nWallet: ${getAddress(wallet)}\nCurve: P-256\nX: ${key.x}\nY: ${key.y}\nChallenge: ${nonce}`;
const holderMessage = (c: {cert_id: string;nonce: string;request_context: string;expires_at: string}) =>
  `DID-Chain Holder Proof\nCertificate: ${c.cert_id}\nChallenge: ${c.nonce}\nVerifier: ${c.request_context}\nExpires: ${c.expires_at}`;
async function userFrom(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Sign in to use this action');
  const token = authorization.slice(7);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new Error('Invalid login session');
  return user;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' },405);
  if (Number(req.headers.get('content-length') || 0) > 10000) return reply({ error: 'Request too large' },413);
  try {
    const body = await req.json();
    if (body.action === 'holder_challenge') {
      if (!isHex(body.pdfSha256) || typeof body.context !== 'string' || body.context.length < 3 || body.context.length > 120) return reply({ error: 'Invalid request' },400);
      const { data: cred } = await admin.from('credentials').select('cert_id,holder_wallet,issuance_state')
        .eq('pdf_sha256',body.pdfSha256).maybeSingle();
      if (!cred || cred.issuance_state === 'pending') return reply({ error: 'Credential unavailable' },404);
      const { data, error } = await admin.from('ownership_challenges').insert({
        cert_id: cred.cert_id, expected_holder_wallet: cred.holder_wallet, nonce: freshNonce(),
        request_context: body.context.trim(), expires_at: new Date(Date.now()+2*60*1000).toISOString()
      }).select().single();
      if (error || !data) throw new Error('Could not create ownership challenge');
      return reply({ challenge: { id: data.id, certId: data.cert_id, nonce: data.nonce,
        context: data.request_context, expiresAt: data.expires_at, expectedHolder: data.expected_holder_wallet } });
    }
    if (body.action === 'holder_prove') {
      if (typeof body.id !== 'string' || typeof body.signature !== 'string') return reply({ error: 'Invalid request' },400);
      const { data: challenge } = await admin.from('ownership_challenges').select('*').eq('id',body.id).maybeSingle();
      if (!challenge || challenge.used_at || Date.parse(challenge.expires_at) <= Date.now()) return reply({ confirmed: false, reason: 'Expired or reused challenge' },409);
      let verified = false;
      try { verified = getAddress(verifyMessage(holderMessage(challenge), body.signature)) === getAddress(challenge.expected_holder_wallet); }
      catch { /* invalid signature */ }
      if (!verified) return reply({ confirmed: false, reason: 'Signature is not from the registered holder wallet' });
      const { data: consumed, error } = await admin.rpc('consume_ownership_challenge', { p_id: challenge.id, p_cert: challenge.cert_id, p_nonce: challenge.nonce });
      if (error || !consumed) return reply({ confirmed: false, reason: 'Challenge already used or expired' },409);
      return reply({ confirmed: true });
    }
    const user = await userFrom(req);
    const { data: profile, error: profileError } = await admin.from('profiles').select('*').eq('id',user.id).single();
    if (profileError || !profile) throw new Error('Profile missing');
    if (body.action === 'create_challenge') {
      if (body.purpose !== 'wallet' && body.purpose !== 'encryption') return reply({ error: 'Unknown challenge purpose' },400);
      const { data, error } = await admin.from('auth_challenges').insert({
        user_id: user.id, purpose: body.purpose, nonce: freshNonce(), expires_at: new Date(Date.now()+5*60*1000).toISOString()
      }).select('id,nonce,expires_at').single();
      if (error || !data) throw new Error('Cannot create authentication challenge');
      return reply({ id: data.id, nonce: data.nonce, expiresAt: data.expires_at });
    }
    if (body.action === 'bind_wallet' || body.action === 'bind_key') {
      const purpose = body.action === 'bind_wallet' ? 'wallet' : 'encryption';
      const { data: ch } = await admin.from('auth_challenges').select('*').eq('id',body.challengeId).eq('user_id',user.id).eq('purpose',purpose).maybeSingle();
      if (!ch || ch.used_at || Date.parse(ch.expires_at) <= Date.now()) return reply({ error: 'Expired or missing challenge' },409);
      if (typeof body.signature !== 'string' || typeof body.wallet !== 'string') return reply({ error: 'Invalid signature payload' },400);
      const wallet = getAddress(body.wallet);
      if (purpose === 'wallet') {
        if (profile.wallet_address) return reply({ error: 'Wallet already bound; changing it needs administrator recovery' },403);
        if (profile.role === 'student') {
          if (!profile.university_id) return reply({ error: 'Claim a student record before linking wallet' },403);
        } else {
          const { data: uni } = await admin.from('universities').select('issuer_wallet,approved').eq('id',profile.university_id).maybeSingle();
          if (!uni?.approved || getAddress(uni.issuer_wallet) !== wallet) return reply({ error: 'Wallet not approved for this institution' },403);
        }
      } else {
        if (profile.role !== 'student' || !profile.wallet_address || getAddress(profile.wallet_address) !== wallet) return reply({ error: 'Student wallet not yet linked' },403);
        if (profile.encryption_public_key) return reply({ error: 'Existing encryption key; administrator recovery required for rotation' },409);
        const k = body.publicJwk as JsonWebKey;
        if (!k || k.kty !== 'EC' || k.crv !== 'P-256' || typeof k.x !== 'string' || typeof k.y !== 'string') return reply({ error: 'Invalid P-256 key' },400);
        try { await crypto.subtle.importKey('jwk',k,{name:'ECDH',namedCurve:'P-256'},false,[]); }
        catch { return reply({ error: 'Malformed P-256 curve point' },400); }
      }
      const signedText = purpose === 'wallet' ? walletMessage(user.id, wallet, ch.nonce) : encryptionMessage(user.id, wallet, body.publicJwk, ch.nonce);
      let recovered;
      try { recovered = getAddress(verifyMessage(signedText,body.signature)); }
      catch { return reply({ error: 'Invalid signature' },403); }
      if (recovered !== wallet) return reply({ error: 'Signature and wallet do not match' },403);
      const { data: used, error: usedError } = await admin.rpc('consume_auth_challenge', {
        p_id: ch.id, p_user: user.id, p_purpose: purpose, p_nonce: ch.nonce
      });
      if (usedError || !used) return reply({ error: 'Challenge already used' },409);
      const updates = purpose === 'wallet'
        ? { wallet_address: wallet, wallet_binding_signature: body.signature, wallet_binding_challenge: ch.nonce }
        : { encryption_public_key: body.publicJwk, encryption_key_binding_signature: body.signature, encryption_key_binding_challenge: ch.nonce };
      const guard = admin.from('profiles').update(updates).eq('id', user.id);
      const { data: updated, error: updateError } = purpose === 'wallet'
        ? await guard.is('wallet_address',null).select('id').maybeSingle()
        : await guard.is('encryption_public_key',null).select('id').maybeSingle();
      if (updateError || !updated) throw new Error(`Wallet binding persistence failed or changed concurrently: ${updateError?.message || 'profile already bound'}`);
      return reply({ ok: true });
    }
    return reply({ error: 'Unknown action' },400);
  } catch (e) { return reply({ error: (e as Error).message || 'Service error' },400); }
});
