import { getAddress } from 'ethers';
import { connectWallet, ensureNetwork, getRpc, getRegistry, issuerAuthorized, registerDigest, revokeDigest } from '../blockchain/registry';
import { rand32, signCredential, toJSON, fromJSON, type CredentialJSON, type Hex32 } from '../crypto/eip712';
import { pdfSha256 } from '../crypto/hashing';
import { makeCertificate } from '../pdf/certificate';
import { encryptPackage, toB64, verifyKeyBinding, type EncryptedPackage } from '../crypto/encryption';
import { requireSupabase, type CredentialRow, type Profile, type StudentRecord, type University } from './client';

const sb = () => requireSupabase();
function iso(s: number) { return new Date(s * 1000).toISOString(); }
async function downloadOriginal(row: CredentialRow): Promise<Uint8Array> {
  const { data, error } = await sb().storage.from('didchain-pdfs').download(row.pdf_storage_path);
  if (error || !data) throw new Error(error?.message || 'Original PDF unavailable');
  return new Uint8Array(await data.arrayBuffer());
}
async function ensureStudentProfile(student: StudentRecord, institution: University) {
  if (!student.claimed_by) throw new Error('Student must claim this record before issuance');
  const { data, error } = await sb().from('profiles').select('*').eq('id',student.claimed_by).single();
  if (error || !data) throw new Error('Student profile inaccessible');
  const profile = data as Profile;
  if (!profile.wallet_address || !profile.encryption_public_key || !profile.encryption_key_binding_signature || !profile.encryption_key_binding_challenge || !profile.wallet_binding_signature)
    throw new Error('Student needs wallet linking and encryption-key onboarding first');
  if (profile.university_id !== institution.id) throw new Error('Student institution mismatch');
  // Independently verify the wallet-to-P256-key binding recorded by the trusted identity Edge Function.
  if (!verifyKeyBinding(profile.id, profile.wallet_address, profile.encryption_public_key,
      profile.encryption_key_binding_challenge, profile.encryption_key_binding_signature)) {
    throw new Error('Student encryption public key fails its wallet-signed binding verification');
  }
  return profile;
}
export async function issueCertificate(student: StudentRecord, uni: University, qualification: string, expiresAt: number, setProgress: (value:string) => void) {
  const { signer, address, provider } = await connectWallet();
  await ensureNetwork(provider);
  if (getAddress(uni.issuer_wallet) !== address || !await issuerAuthorized(address)) throw new Error('Connected wallet is not an authorized issuer');
  const studentProfile = await ensureStudentProfile(student, uni);
  const issuedAt = Math.floor(Date.now() / 1000);
  if (expiresAt && expiresAt <= issuedAt) throw new Error('Expiry must be after issue date');
  const certId = rand32(), salt = rand32();
  setProgress('Generating and freezing final certificate PDF');
  const pdf = await makeCertificate({ institution: uni.name, studentName: student.student_name, qualification, certId, issuedAt, expiresAt });
  const hash = await pdfSha256(pdf);
  const credential = {
    certId, salt, issuer: address, holder: studentProfile.wallet_address!, institution: uni.name,
    studentName: student.student_name, qualification, issuedAt: BigInt(issuedAt),
    expiresAt: BigInt(expiresAt), pdfSha256: hash
  };
  setProgress('Requesting a real EIP-712 MetaMask signature');
  const { signature, digest } = await signCredential(signer, credential);
  const pdfPath = `${uni.id}/${certId}.pdf`, packagePath = `${student.claimed_by}/${certId}.json`;
  setProgress('Saving signed evidence as PENDING, before blockchain transaction');
  const { error: insertError } = await sb().from('credentials').insert({
    cert_id: certId, university_id: uni.id, student_record_id: student.id, issuer_wallet: address,
    holder_wallet: credential.holder, signed_credential_data: toJSON(credential),
    issuer_signature: signature, pdf_sha256: hash, credential_digest: digest,
    issue_date: iso(issuedAt), expiry_date: expiresAt ? iso(expiresAt) : null,
    issuance_state: 'pending', pdf_storage_path: pdfPath, encrypted_package_path: packagePath, is_demo: true
  });
  if (insertError) throw new Error(`Pending issuance save failed: ${insertError.message}`);
  // Save the exact original bytes BEFORE submitting chain tx, so a browser crash doesn't lose the PDF.
  const blob = new Blob([Uint8Array.from(pdf).buffer as ArrayBuffer], { type: 'application/pdf' });
  const { error: storageError } = await sb().storage.from('didchain-pdfs').upload(pdfPath,blob,{ contentType: 'application/pdf', upsert: false });
  if (storageError) throw new Error(`PDF storage failed. Pending record retained for recovery: ${storageError.message}`);
  setProgress('Submitting signed digest to Hardhat through MetaMask');
  const tx = await registerDigest(signer, digest);
  const { error: updateError } = await sb().from('credentials').update({
    issuance_state:'registered', transaction_hash:tx.transactionHash, block_number:tx.blockNumber
  }).eq('cert_id', certId);
  if (updateError) throw new Error(`Chain succeeded, but database sync failed. Use Reconcile Pending: ${updateError.message}`);
  setProgress('Encrypting and securely delivering original PDF');
  try {
    const payload = { pdfBase64: toB64(pdf), credential: toJSON(credential), issuerSignature: signature };
    const pack = await encryptPackage(payload,credential.holder,studentProfile.encryption_public_key!);
    await uploadDelivery(certId, packagePath,pack);
    setProgress('Certificate successfully issued and encrypted package delivered');
    return { certId, hash, digest, ...tx };
  } catch (error) {
    await sb().from('credentials').update({ issuance_state:'delivery_failed' }).eq('cert_id',certId);
    throw new Error(`Chain registration succeeded. Delivery can be retried from History: ${(error as Error).message}`);
  }
}
async function uploadDelivery(certId: string, path: string, pack: EncryptedPackage) {
  const blob = new Blob([JSON.stringify(pack)], { type:'application/json' });
  const { error: uploadError } = await sb().storage.from('didchain-packages').upload(path,blob,{ upsert:false, contentType:'application/json' });
  if (uploadError) {
    if (uploadError.message.includes('already exists')) {
      // An interrupted flow may have uploaded the package before DB confirmation.
      const { data, error } = await sb().storage.from('didchain-packages').download(path);
      if (error || !data) throw uploadError;
      const existing = JSON.parse(await data.text()) as EncryptedPackage;
      if (existing.certId !== certId || existing.version !== 1) throw new Error('Conflicting package exists at delivery path');
    } else throw uploadError;
  }
  const { error } = await sb().from('credentials').update({ issuance_state:'delivered', encrypted_package_path:path }).eq('cert_id',certId);
  if (error) throw error;
}
export async function reconcileCredential(row: CredentialRow): Promise<string> {
  if (row.issuance_state !== 'pending') throw new Error('Only pending records can be reconciled');
  const rpc = getRpc(); await ensureNetwork(rpc);
  const registry = getRegistry(rpc);
  const record = await registry.getCredential(row.credential_digest);
  if (getAddress(record[0]) !== getAddress(row.issuer_wallet)) throw new Error('Digest not registered by original issuer: cannot mark as confirmed');
  let hash = row.transaction_hash;
  let block = row.block_number;
  if (!hash) {
    const events = await registry.queryFilter(registry.filters.CredentialRegistered(row.credential_digest), 0, 'latest');
    const event = events.find(e => 'transactionHash' in e);
    hash = event?.transactionHash || null;
    block = event?.blockNumber || null;
  }
  const { error } = await sb().from('credentials').update({ issuance_state:'registered', transaction_hash:hash, block_number:block }).eq('cert_id', row.cert_id);
  if (error) throw error;
  return 'Blockchain registration matched; database record reconciled';
}
export async function retryDelivery(row: CredentialRow, uni: University): Promise<string> {
  if (!['registered','delivery_failed'].includes(row.issuance_state)) throw new Error('Credential is not awaiting delivery');
  const pdf = await downloadOriginal(row);
  if (await pdfSha256(pdf) !== row.pdf_sha256) throw new Error('Stored PDF hash mismatch');
  const { data: record, error } = await sb().from('student_records').select('*').eq('id',row.student_record_id).single();
  if (error || !record) throw new Error('Student record unavailable');
  const profile = await ensureStudentProfile(record as StudentRecord, uni);
  if (getAddress(profile.wallet_address!) !== getAddress(row.holder_wallet)) throw new Error('Holder wallet changed; re-enrollment needs authorization');
  const c = row.signed_credential_data as unknown as CredentialJSON;
  if (fromJSON(c).certId !== row.cert_id) throw new Error('Signed evidence mismatch');
  const pack = await encryptPackage({ pdfBase64:toB64(pdf), credential:c, issuerSignature:row.issuer_signature },row.holder_wallet,profile.encryption_public_key!);
  await uploadDelivery(row.cert_id,row.encrypted_package_path!,pack);
  return 'Encrypted delivery confirmed';
}
export async function revokeCertificate(row: CredentialRow) {
  const { signer, address } = await connectWallet();
  if (getAddress(row.issuer_wallet) !== address) throw new Error('Only original issuer wallet can revoke');
  const txHash = await revokeDigest(signer,row.credential_digest as Hex32);
  const { error } = await sb().from('credentials').update({ issuance_state:'revoked', revocation_transaction_hash:txHash }).eq('cert_id',row.cert_id);
  if (error) throw new Error(`Revoked on-chain, database sync failed: ${error.message}`);
  return txHash;
}
