import { getAddress, verifyMessage } from 'ethers';
import type { CredentialJSON } from './eip712';
import { pdfSha256 } from './hashing';

export type KeyRecord = { publicJwk: JsonWebKey; privateKey: CryptoKey };
export type CredentialPayload = { pdfBase64: string; credential: CredentialJSON; issuerSignature: string };
export type EncryptedPackage = {
  version: 1; certId: string; recipient: string; ephemeralPublicJwk: JsonWebKey;
  hkdfSalt: string; iv: string; ciphertext: string;
};
const base64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const from64 = (value: string): Uint8Array => Uint8Array.from(atob(value), x => x.charCodeAt(0));
export const toB64 = base64;
export const fromB64 = from64;
const bytes = (s: string) => new TextEncoder().encode(s);
const random = (len: number) => crypto.getRandomValues(new Uint8Array(len));

// Persist non-extractable browser key, not raw key material. IndexedDB CryptoKey clone.
const dbName = 'didchain-student-keys-v1';
async function keyDB(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('keys');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveKey(account: string, record: KeyRecord) {
  const db = await keyDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction('keys', 'readwrite');
    t.objectStore('keys').put(record, account);
    t.oncomplete = () => resolve(); t.onerror = () => reject(t.error);
  });
  db.close();
}
export async function loadKey(account: string): Promise<KeyRecord | undefined> {
  const db = await keyDB();
  const value = await new Promise<KeyRecord | undefined>((resolve, reject) => {
    const r = db.transaction('keys', 'readonly').objectStore('keys').get(account);
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  db.close(); return value;
}
export async function generateStudentKey(): Promise<KeyRecord> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  return { privateKey: kp.privateKey, publicJwk: await crypto.subtle.exportKey('jwk', kp.publicKey) };
}
export function encryptionKeyBindingMessage(userId: string, wallet: string, publicJwk: JsonWebKey, challenge: string) {
  // Canonical order: no JSON stringification ambiguity in message/proof.
  const { kty, crv, x, y } = publicJwk;
  if (kty !== 'EC' || crv !== 'P-256' || !x || !y) throw new Error('P-256 public key expected');
  return `DID-Chain Encryption Key Binding\nUser: ${userId}\nWallet: ${getAddress(wallet)}\nCurve: P-256\nX: ${x}\nY: ${y}\nChallenge: ${challenge}`;
}
export function verifyKeyBinding(userId: string, wallet: string, jwk: JsonWebKey, challenge: string, signature: string) {
  try { return getAddress(verifyMessage(encryptionKeyBindingMessage(userId, wallet, jwk, challenge), signature)) === getAddress(wallet); }
  catch { return false; }
}
function aadFor(certId: string, recipient: string) { return bytes(`DID-Chain/v1|${certId}|${getAddress(recipient)}`); }
async function deriveKey(privateKey: CryptoKey, publicKey: CryptoKey, salt: Uint8Array, certId: string, recipient: string) {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const ikm = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(salt), info: bytes(`DID-Chain/AES-GCM/v1|${certId}|${getAddress(recipient)}`) },
    ikm, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}
export async function encryptPackage(payload: CredentialPayload, recipientWallet: string, studentPublicJwk: JsonWebKey): Promise<EncryptedPackage> {
  const certId = payload.credential.certId;
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicKey = await crypto.subtle.importKey('jwk', studentPublicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const salt = random(32), iv = random(12);
  const key = await deriveKey(ephemeral.privateKey, publicKey, salt, certId, recipientWallet);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadFor(certId, recipientWallet), tagLength: 128 }, key, bytes(JSON.stringify(payload)));
  return {
    version: 1, certId, recipient: getAddress(recipientWallet),
    ephemeralPublicJwk: await crypto.subtle.exportKey('jwk', ephemeral.publicKey),
    hkdfSalt: base64(salt), iv: base64(iv), ciphertext: base64(new Uint8Array(ciphertext))
  };
}
export async function decryptPackage(pack: EncryptedPackage, keyRecord: KeyRecord, wallet: string): Promise<CredentialPayload> {
  if (pack.version !== 1 || getAddress(pack.recipient) !== getAddress(wallet)) throw new Error('Package recipient does not match this wallet');
  const ephemeralPublic = await crypto.subtle.importKey('jwk', pack.ephemeralPublicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const aes = await deriveKey(keyRecord.privateKey, ephemeralPublic, from64(pack.hkdfSalt), pack.certId, pack.recipient);
  const decoded = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(from64(pack.iv)), additionalData: aadFor(pack.certId, pack.recipient), tagLength: 128 }, aes, new Uint8Array(from64(pack.ciphertext)));
  const payload = JSON.parse(new TextDecoder().decode(decoded)) as CredentialPayload;
  if (payload.credential.certId !== pack.certId || getAddress(payload.credential.holder) !== getAddress(pack.recipient)) throw new Error('Decrypted credential context mismatch');
  const computed = await pdfSha256(from64(payload.pdfBase64));
  if (computed !== payload.credential.pdfSha256) throw new Error('Decrypted PDF failed fingerprint validation');
  return payload;
}
