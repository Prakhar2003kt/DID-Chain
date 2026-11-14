import { describe, expect, it } from 'vitest';
import { Wallet } from 'ethers';
import { ownershipMessage, verifyOwnership, type HolderChallenge } from '../lib/crypto/ownership';
import { rand32 } from '../lib/crypto/eip712';
describe('Holder challenge signing',()=>{
 it('proves matching wallet only, rejects other wallets and altered contexts', async()=>{
   const holder=Wallet.createRandom(),attacker=Wallet.createRandom();
   const c:HolderChallenge={id:crypto.randomUUID(),certId:rand32(),nonce:rand32(),context:'Hiring verification',expiresAt:new Date(Date.now()+60000).toISOString(),expectedHolder:holder.address};
   const valid=await holder.signMessage(ownershipMessage(c));
   expect(verifyOwnership(c,valid)).toBe(true);
   expect(verifyOwnership({...c,context:'Other verifier'},valid)).toBe(false);
   const attack=await attacker.signMessage(ownershipMessage(c));
   expect(verifyOwnership(c,attack)).toBe(false);
   // Replay prevention requires trusted DB consumption, tested by Supabase integration test.
 });
});
