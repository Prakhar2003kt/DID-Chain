import { getAddress, randomBytes, hexlify, TypedDataEncoder, verifyTypedData, type Signer } from 'ethers';
import deployment from '../../generated/deployment.json';

export type Hex32 = `0x${string}`;
export type Credential = {
  certId: Hex32;
  issuer: string;
  holder: string;
  institution: string;
  studentName: string;
  qualification: string;
  issuedAt: bigint;
  expiresAt: bigint;
  pdfSha256: Hex32;
  salt: Hex32;
};
export type CredentialJSON = Omit<Credential, 'issuedAt' | 'expiresAt'> & { issuedAt: string; expiresAt: string };
export const credentialTypes: Record<string, Array<{ name: string; type: string }>> = {
  Credential: [
    { name: 'certId', type: 'bytes32' }, { name: 'issuer', type: 'address' },
    { name: 'holder', type: 'address' }, { name: 'institution', type: 'string' },
    { name: 'studentName', type: 'string' }, { name: 'qualification', type: 'string' },
    { name: 'issuedAt', type: 'uint256' }, { name: 'expiresAt', type: 'uint256' },
    { name: 'pdfSha256', type: 'bytes32' }, { name: 'salt', type: 'bytes32' }
  ]
};
export const rand32 = (): Hex32 => hexlify(randomBytes(32)) as Hex32;
export type DomainOverride = { chainId: number; verifyingContract: string };
export const domain = (override?: DomainOverride) => ({
  name: 'DID-Chain', version: '1', chainId: BigInt(override?.chainId ?? deployment.chainId),
  verifyingContract: override ? getAddress(override.verifyingContract) : requireAddress()
});
export function requireAddress() {
  if (!deployment.address || !deployment.abi.length) throw new Error('Contract not deployed. Run npm run deploy first.');
  return getAddress(deployment.address);
}
export function toJSON(c: Credential): CredentialJSON {
  return { ...c, issuedAt: c.issuedAt.toString(), expiresAt: c.expiresAt.toString() };
}
export function fromJSON(c: CredentialJSON): Credential {
  return { ...c, issuedAt: BigInt(c.issuedAt), expiresAt: BigInt(c.expiresAt) };
}
export function digestOf(c: Credential, override?: DomainOverride): Hex32 {
  return TypedDataEncoder.hash(domain(override), credentialTypes, c) as Hex32;
}
export async function signCredential(signer: Signer, c: Credential, override?: DomainOverride) {
  if (getAddress(await signer.getAddress()) !== getAddress(c.issuer)) throw new Error('Wrong issuer signer');
  const signature = await signer.signTypedData(domain(override), credentialTypes, c);
  if (getAddress(verifyTypedData(domain(override), credentialTypes, c, signature)) !== getAddress(c.issuer)) {
    throw new Error('Issuer signature verification failed');
  }
  return { signature, digest: digestOf(c, override) };
}
export function verifyIssuer(c: Credential, signature: string, override?: DomainOverride): boolean {
  try { return getAddress(verifyTypedData(domain(override), credentialTypes, c, signature)) === getAddress(c.issuer); }
  catch { return false; }
}
export function pkh(address: string) {
  return `did:pkh:eip155:${deployment.chainId}:${getAddress(address)}`;
}
