import { BrowserProvider, Contract, JsonRpcProvider, getAddress, type Eip1193Provider } from 'ethers';
import deployment from '../../generated/deployment.json';
import { requireAddress, type Hex32 } from '../crypto/eip712';

export const CHAIN_ID = BigInt(deployment.chainId);
export const rpcUrl = import.meta.env.VITE_LOCAL_RPC_URL || 'http://127.0.0.1:8545';
export const getRpc = () => new JsonRpcProvider(rpcUrl, Number(CHAIN_ID), { staticNetwork: false });
export function getRegistry(connection: BrowserProvider | JsonRpcProvider) {
  return new Contract(requireAddress(), deployment.abi, connection);
}
export async function ensureNetwork(provider: BrowserProvider | JsonRpcProvider) {
  const network = await provider.getNetwork();
  if (network.chainId !== CHAIN_ID) throw new Error(`Wrong network: expected ${CHAIN_ID}, got ${network.chainId}`);
  const code = await provider.getCode(requireAddress());
  if (code === '0x') throw new Error('Registry contract missing. Local Hardhat chain may have reset; redeploy.');
  return network;
}
export async function connectWallet() {
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  if (!eth) throw new Error('MetaMask was not detected in this browser');
  await eth.request({ method: 'eth_requestAccounts' });
  const provider = new BrowserProvider(eth);
  await ensureNetwork(provider);
  const signer = await provider.getSigner();
  return { provider, signer, address: getAddress(await signer.getAddress()) };
}
export async function issuerAuthorized(address: string) {
  const p = getRpc(); await ensureNetwork(p);
  return (await getRegistry(p).isAuthorizedIssuer(address)) as boolean;
}
export async function registerDigest(signer: Awaited<ReturnType<typeof connectWallet>>['signer'], digest: Hex32) {
  const contract = getRegistry(getRpc()).connect(signer) as Contract;
  const tx = await contract.registerCredential(digest);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error('Chain registration failed');
  return { transactionHash: receipt.hash as string, blockNumber: receipt.blockNumber as number };
}
export async function revokeDigest(signer: Awaited<ReturnType<typeof connectWallet>>['signer'], digest: Hex32) {
  const contract = getRegistry(getRpc()).connect(signer) as Contract;
  const tx = await contract.revokeCredential(digest);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error('Revocation transaction failed');
  return receipt.hash as string;
}
