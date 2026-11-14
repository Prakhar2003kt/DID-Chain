import { describe, expect, it } from 'vitest';
import { assertPdf, pdfSha256 } from '../lib/crypto/hashing';
import { makeCertificate } from '../lib/pdf/certificate';
import { rand32 } from '../lib/crypto/eip712';
describe('Exact PDF SHA-256 integrity',()=>{
 it('creates valid PDF, detects modification without reserializing original',async()=>{
   const orig=await makeCertificate({institution:'Example University',studentName:'Alice',qualification:'Master of Cybersecurity',certId:rand32(),issuedAt:1760000000,expiresAt:0});
   expect(()=>assertPdf(orig)).not.toThrow();
   const h1=await pdfSha256(orig);
   const altered=Uint8Array.from(orig);altered[100]^=0x01;
   expect(await pdfSha256(altered)).not.toEqual(h1);
   expect(await pdfSha256(orig)).toEqual(h1);
 });
 it('rejects invalid header and oversized file',()=>{
   expect(()=>assertPdf(new TextEncoder().encode('fake pdf document'))).toThrow();
   expect(()=>assertPdf(new Uint8Array(8*1024*1024+1))).toThrow();
 });
});
