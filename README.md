# DID-Chain — Blockchain-Based Decentralized Identity and Academic Credential Verification

An academic cryptography prototype built around three real roles: a **university issuer** digitally signs and registers academic PDF credentials; a **student holder** receives AES-GCM-encrypted documents; an **employer verifier** uploads the original PDF for independent EIP-712 signature, exact SHA-256 and local Ethereum contract checks.

**Important: source generated, not yet fully integration-tested.** Read [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) first. Full installation: [MANUAL_SETUP.md](MANUAL_SETUP.md).

## Technology

React 19 + Vite 7 + TypeScript + Tailwind CSS 4 + shadcn-style reusable UI primitives + React Router + Zod; Hardhat 3 + Solidity/OpenZeppelin AccessControl + ethers v6 + MetaMask; Supabase Auth, Postgres/RLS, private Storage, Edge Functions; Web Crypto P-256 ECDH/HKDF-SHA256/AES-256-GCM; pdf-lib.

## Architecture

`contracts/`: genuine issuer registry and Ethereum permission tests. `web/`: three role experiences, issuance/recovery, cryptography, employer PDF verification, Vitest tests. `supabase/`: migrations, Storage policies, privileged Edge Functions. `scripts/`: readiness/static checks and explicitly gated demo reset. `docs/`: architecture/security notes and source disclosure.

## Quick start (after installing/configuring Supabase and MetaMask)

```bash
npm install
npm run chain                # terminal 1, leave running
npm run deploy               # terminal 2, exports real ABI/address
ISSUER_WALLET=0x... npm run authorize:issuer  # demo-only test address
npm run dev                  # terminal 3
```

The `npm install` command above requires network access and must produce a **real** lockfile. CLI installation, Supabase linking/migrations and manual trusted issuer bootstrap are required before attempting live issuance.

## Core trust chain

1. Generate exact PDF and compute SHA-256.
2. EIP-712 sign typed credential with issuer wallet; compute its digest.
3. Save pending evidence + original bytes; register digest on local Hardhat and confirm.
4. Encrypt PDF and signed proof with P-256 ECDH → HKDF-SHA256 → AES-256-GCM to linked student public key.
5. Employer uploads only PDF; browser retrieves restricted matching proof and checks signature, chain registration, issuer authorization, revocation, expiry and correct contract domain.
6. Optional holder wallet challenge proves possession of linked signing wallet, not physical identity.

The proof endpoint runs in hosted Supabase and does **not** connect to your Mac's `localhost`; the verifier's browser connects to Hardhat locally. The demo requires the employer-verifier browser to run on the same computer.

## Scope and honesty

This is not a public decentralized deployment, PAdES-signed PDF, production identity service, or complete W3C VC interoperability implementation. Database RLS and cryptography require real integration evidence before declaring a secure working prototype. AI assistance must be acknowledged according to university policies. No live secrets belong in Git.
