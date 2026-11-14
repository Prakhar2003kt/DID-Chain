import { getAddress } from 'ethers';
import { z } from 'zod';
import { fromJSON, verifyIssuer, digestOf, requireAddress, type CredentialJSON } from '../crypto/eip712';
import { assertPdf, pdfSha256 } from '../crypto/hashing';
import { getRpc, getRegistry, ensureNetwork } from '../blockchain/registry';
import { supabaseConfig } from '../supabase/client';

export type Verdict = 'VALID' | 'INVALID' | 'REVOKED' | 'EXPIRED' | 'UNTRUSTED ISSUER' | 'VERIFICATION UNAVAILABLE';
export type Check = { name: string; ok: boolean; message: string };
export type Verification = { verdict: Verdict; checks: Check[]; digest?: string; transactionHash?: string; issuer?: string; holder?: string; certId?: string };
const proofSchema = z.object({
  credential: z.object({
    certId: z.string(), issuer: z.string(), holder: z.string(), institution: z.string(),
    studentName: z.string(), qualification: z.string(), issuedAt: z.string(), expiresAt: z.string(),
    pdfSha256: z.string(), salt: z.string()
  }),
  issuerSignature: z.string(),
  institutionWallet: z.string(), institutionApproved: z.boolean(),
  institutionName: z.string(), transactionHash: z.string().nullable()
});

export async function verifyPDF(bytes: Uint8Array): Promise<Verification> {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, message: string) => checks.push({ name, ok, message });
  try { assertPdf(bytes); add('File validation', true, 'PDF header and size accepted'); }
  catch (e) { add('File validation', false, (e as Error).message); return { verdict: 'INVALID', checks }; }
  const hash = await pdfSha256(bytes);
  add('SHA-256 fingerprint', true, hash);
  let proof: z.infer<typeof proofSchema>;
  try {
    const r = await fetch(`${supabaseConfig.url}/functions/v1/verification-api`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: supabaseConfig.key },
      body: JSON.stringify({ pdfSha256: hash })
    });
    if (r.status === 404) { add('Signed evidence lookup', false, 'No issuance proof matches this exact PDF'); return { verdict: 'INVALID', checks }; }
    if (!r.ok) throw new Error(`Verification proof service status ${r.status}`);
    proof = proofSchema.parse(await r.json());
    add('Signed evidence lookup', true, 'Matching restricted proof returned');
  } catch (e) {
    add('Signed evidence lookup', false, (e as Error).message);
    return { verdict: 'VERIFICATION UNAVAILABLE', checks };
  }
  const c = proof.credential as CredentialJSON;
  const evidence = { checks, certId: c.certId, issuer: c.issuer, holder: c.holder, transactionHash: proof.transactionHash || undefined };
  if (c.pdfSha256.toLowerCase() !== hash.toLowerCase()) {
    add('PDF integrity', false, 'Proof fingerprint differs'); return { ...evidence, verdict: 'INVALID' };
  }
  add('PDF integrity', true, 'Uploaded bytes match signed fingerprint');
  let digest: string;
  try {
    const typed = fromJSON(c);
    if (!verifyIssuer(typed, proof.issuerSignature)) throw new Error('Signature does not recover issuer wallet');
    if (getAddress(typed.issuer) !== getAddress(proof.institutionWallet) || typed.institution !== proof.institutionName) {
      throw new Error('Signed issuer/institution does not match approved registry data');
    }
    if (typed.issuedAt > BigInt(Math.floor(Date.now() / 1000))) throw new Error('Credential issue date lies in future');
    digest = digestOf(typed);
    add('EIP-712 signature', true, `Recovered authorized signer ${c.issuer}`);
  } catch (e) { add('EIP-712 signature', false, (e as Error).message); return { ...evidence, verdict: 'INVALID' }; }
  const info = { ...evidence, digest };
  let recordedIssuer: string, revoked: boolean, authorized: boolean;
  try {
    if (!requireAddress()) throw new Error('Contract not configured');
    const rpc = getRpc();
    await ensureNetwork(rpc);
    const reg = getRegistry(rpc);
    const record = await reg.getCredential(digest);
    recordedIssuer = record[0] as string;
    revoked = record[2] as boolean;
    authorized = await reg.isAuthorizedIssuer(c.issuer) as boolean;
  } catch (e) {
    add('Blockchain availability', false, (e as Error).message);
    return { ...info, verdict: 'VERIFICATION UNAVAILABLE' };
  }
  if (recordedIssuer === '0x0000000000000000000000000000000000000000' || getAddress(recordedIssuer) !== getAddress(c.issuer)) {
    add('On-chain registration', false, 'Digest absent or registered by a different issuer');
    return { ...info, verdict: 'INVALID' };
  }
  add('On-chain registration', true, `Digest ${digest} registered by issuer`);
  // Deterministic precedence: invalid > revoked > untrusted > expired > valid.
  if (revoked) { add('Revocation', false, 'Blockchain credential revoked'); return { ...info, verdict: 'REVOKED' }; }
  add('Revocation', true, 'Not revoked');
  if (!authorized || !proof.institutionApproved) {
    add('Current issuer trust', false, 'Issuer suspended or institution not approved');
    return { ...info, verdict: 'UNTRUSTED ISSUER' };
  }
  add('Current issuer trust', true, 'Issuer currently authorized and institution approved');
  if (BigInt(c.expiresAt) !== 0n && BigInt(c.expiresAt) <= BigInt(Math.floor(Date.now() / 1000))) {
    add('Expiry', false, 'Signed credential expired'); return { ...info, verdict: 'EXPIRED' };
  }
  add('Expiry', true, 'Not expired');
  return { ...info, verdict: 'VALID' };
}
