import { hexlify } from 'ethers';
import type { Hex32 } from './eip712';

export async function pdfSha256(bytes: Uint8Array | ArrayBuffer): Promise<Hex32> {
  const raw = bytes instanceof Uint8Array ? Uint8Array.from(bytes).buffer as ArrayBuffer : bytes;
  return hexlify(new Uint8Array(await crypto.subtle.digest('SHA-256', raw))) as Hex32;
}
export function assertPdf(bytes: Uint8Array) {
  if (bytes.length < 8 || bytes.length > 8 * 1024 * 1024) throw new Error('Invalid PDF size. Maximum allowed is 8 MB.');
  const head = new TextDecoder().decode(bytes.slice(0, 5));
  if (head !== '%PDF-') throw new Error('Uploaded file is not a PDF.');
}
