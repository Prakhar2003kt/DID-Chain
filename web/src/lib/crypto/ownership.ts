import { getAddress, verifyMessage, type Signer } from 'ethers';
export type HolderChallenge = { id: string; certId: string; nonce: string; context: string; expiresAt: string; expectedHolder: string };
export function ownershipMessage(ch: HolderChallenge) {
  return `DID-Chain Holder Proof\nCertificate: ${ch.certId}\nChallenge: ${ch.nonce}\nVerifier: ${ch.context}\nExpires: ${ch.expiresAt}`;
}
export async function signOwnership(signer: Signer, challenge: HolderChallenge) {
  if (getAddress(await signer.getAddress()) !== getAddress(challenge.expectedHolder)) throw new Error('Wrong holder wallet');
  return signer.signMessage(ownershipMessage(challenge));
}
export function verifyOwnership(ch: HolderChallenge, signature: string) {
  try { return getAddress(verifyMessage(ownershipMessage(ch), signature)) === getAddress(ch.expectedHolder); }
  catch { return false; }
}
