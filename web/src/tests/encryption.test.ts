import { describe, expect, it } from 'vitest';
import { Wallet } from 'ethers';
import { encryptPackage, decryptPackage, generateStudentKey, toB64, type CredentialPayload } from '../lib/crypto/encryption';
import { pdfSha256 } from '../lib/crypto/hashing';
import { rand32 } from '../lib/crypto/eip712';

describe('Real WebCrypto P-256 ECDH / HKDF / AES-256-GCM',()=>{
  it('decrypts exact bytes and rejects changed ciphertext and AAD binding',async()=>{
    const holder=Wallet.createRandom();const studentKey=await generateStudentKey();
    const pdf=new TextEncoder().encode('%PDF-1.4\nThis is a sample PDF byte sequence.');
    const id=rand32(), hash=await pdfSha256(pdf);
    const payload: CredentialPayload={ pdfBase64:toB64(pdf),issuerSignature:'unused-for-encryption-test',credential:{
      certId:id,issuer:Wallet.createRandom().address,holder:holder.address,institution:'Example',
      studentName:'Alice',qualification:'MSc',issuedAt:'1',expiresAt:'0',pdfSha256:hash,salt:rand32()
    }};
    const ciphertext=await encryptPackage(payload,holder.address,studentKey.publicJwk);
    const plain=await decryptPackage(ciphertext,studentKey,holder.address);
    expect(plain.pdfBase64).toEqual(payload.pdfBase64);
    const modified= {...ciphertext, ciphertext: ciphertext.ciphertext.slice(0,-4)+'AAAA'};
    await expect(decryptPackage(modified,studentKey,holder.address)).rejects.toThrow();
    const mutatedAAD={...ciphertext,certId:rand32()};
    await expect(decryptPackage(mutatedAAD,studentKey,holder.address)).rejects.toThrow();
    await expect(decryptPackage(ciphertext,studentKey,Wallet.createRandom().address)).rejects.toThrow();
  });
});
