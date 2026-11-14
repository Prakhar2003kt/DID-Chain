import { getAddress } from 'ethers';
export function walletBindingMessage(userId: string, wallet: string, challenge: string) {
  return `DID-Chain Wallet Link\nUser: ${userId}\nWallet: ${getAddress(wallet)}\nChallenge: ${challenge}`;
}
