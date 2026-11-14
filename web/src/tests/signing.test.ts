import { describe, expect, it } from 'vitest';
import { Wallet } from 'ethers';
import { rand32, signCredential, verifyIssuer, digestOf, toJSON, fromJSON, type Credential } from '../lib/crypto/eip712';
const TEST = { chainId: 31337, verifyingContract: '0x1111111111111111111111111111111111111111' };
describe('EIP-712 actual secp256k1 credential signatures', () => {
  it('signs and checks structured credentials, rejects mutated signed fields', async () => {
    const issuer = Wallet.createRandom(), holder = Wallet.createRandom();
    const credential: Credential = { certId: rand32(), salt: rand32(), issuer: issuer.address,
      holder: holder.address, institution:'Example University',studentName:'Alice', qualification:'Master of Cybersecurity',
      pdfSha256:rand32(),issuedAt:2000000n,expiresAt:0n };
    const {signature,digest}=await signCredential(issuer,credential,TEST);
    expect(verifyIssuer(credential,signature,TEST)).toBe(true);
    expect(digest).toEqual(digestOf(credential,TEST));
    expect(verifyIssuer({...credential,qualification:'PhD in Cybersecurity'},signature,TEST)).toBe(false);
    expect(verifyIssuer({...credential,pdfSha256:rand32()},signature,TEST)).toBe(false);
    expect(verifyIssuer(credential,signature,{...TEST,chainId:31338})).toBe(false);
    expect(verifyIssuer(credential,signature,{...TEST,verifyingContract:'0x2222222222222222222222222222222222222222'})).toBe(false);
    expect(digestOf(fromJSON(toJSON(credential)),TEST)).toEqual(digest);
  });
});
