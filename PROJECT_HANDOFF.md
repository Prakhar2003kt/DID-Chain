# DID-Chain v1 — AI conversation handoff

**Goal:** postgraduate MACS 902 Modern Cryptography actual functioning academic credential system. One React/Vite/TypeScript responsive website, Hardhat 3 one-contract AccessControl issuer and digest registry, EIP-712 SHA-256 anchored PDF, hosted Supabase Auth/DB/private Storage/Edge Functions, P-256 ECDH/HKDF/AES-256-GCM delivery, optional holder challenge-response, public PDF-only employer verification.

## Source files

- `contracts/contracts/AcademicCredentialRegistry.sol` registers bytes32 EIP-712 digests and stores original registering issuer/timestamp/revoked state.
- `contracts/scripts/deploy.ts` exports actual ABI/address to `web/src/generated/deployment.json`; `contracts/scripts/authorize-issuer.ts` approves demo issuer using local admin.
- `web/src/lib/crypto/eip712.ts` centralizes exact typed fields/domain; `pdf/certificate.ts` creates final PDF; `hashing.ts` hashes exact bytes; `encryption.ts` handles P-256 delivery; `ownership.ts` handles holder proof.
- `web/src/lib/supabase/issuance.ts` implements pending issuance, on-chain registration, private PDF upload, delivery, reconciliation/revocation.
- `web/src/lib/verification/verify.ts` retrieves restricted proof from hosted Edge Function but performs signature and chain checks in the browser (hosted Edge cannot access local Hardhat).
- `supabase/migrations/202611040001_initial.sql` controls DB schema/GRANTs/RLS/storage. `supabase/functions/verification-api` is hash-keyed signed-proof retrieval. `supabase/functions/identity-api` handles wallet challenge, key bind, holder challenges. `supabase/tests/rls_isolation.sql` provides transactional authorization checks.
- `web/src/pages/` includes landing, auth, university dashboard, records, issuance, history/revoke, student vault and key onboarding, public verify/ownership.

## Important immutable interfaces

- EIP-712 domain: `DID-Chain`, version `1`, chain ID `31337`, verifying contract address generated after deploy.
- Typed credential fields in this order: `certId bytes32`, `issuer address`, `holder address`, `institution string`, `studentName string`, `qualification string`, `issuedAt uint256`, `expiresAt uint256`, `pdfSha256 bytes32`, `salt bytes32`.
- PDF bytes created and frozen BEFORE SHA-256/signature; never put the PDF's own hash into it.
- On chain mapping digest→issuer/registeredAt/revoked, current issuer authorization matters.
- Proof endpoint accepts only SHA-256, returns signed evidence and trusted institution mapping; browser validates everything against local RPC, without MetaMask.
- Student private ECDH nonextractable key stored in IndexedDB; student binding uses server verified wallet signature.
- Expired/replayed holder challenges must never be marked confirmed.

## Last checkpoint

`node scripts/staticcheck.mjs` PASSED (syntax only); npm dependency installation FAILED `ENOTCACHED` because runtime cannot access npm registry. **No actual npm typecheck, full build, blockchain test, Supabase migration, real signature test or E2E verification has run**. See `IMPLEMENTATION_STATUS.md`.

## Next action

1. User on Mac: unzip, run `node --version`, `npm --version`, `npm install`. Ask user to paste exact error only if one occurs.
2. After successful install: `npm run staticcheck`, `npm run typecheck`, `npm run build`, `npm run test`, `npm run test:contracts`. Fix errors by narrow patches, update status and commit real lockfile.
3. Run Hardhat node, deploy, authorize test issuer, link hosted Supabase, apply migrations, deploy Edge Functions, manual approved university bootstrap.
4. Verify genuine E2E issue/decrypt/verify/tamper/revoke and all security scenarios. Run transactional SQL RLS checks on disposable Supabase project; retain actual test evidence.
5. Document changes and update handoff. Never claim a source module is proven operational based on its existence.

**Technical limitations:** Local Hardhat not independently decentralized, no production rate limiting or independent security audit, browser decryption key device loss, failed PDF upload can leave pre-chain pending record needing safe cleanup/reissue. Original baseline document remains authoritative; do not expand technology scope without real blocker.
