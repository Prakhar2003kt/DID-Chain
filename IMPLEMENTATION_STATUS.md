# DID-Chain v1 — Implementation status / evidence log

Updated 2026-11-04. **This ZIP contains a substantial executable source implementation, but is NOT yet a validated finished application.** The generation environment could not access the npm registry. Statements below distinguish authored source code from real executed tests. Do not present unexecuted tests as successes.

| Module | Source provided | Executed evidence in generating environment | Status |
|---|---|---|---|
| Monorepo, npm workspaces, configuration, scripts | Yes | JSON and TS/TSX syntax parsed | IMPLEMENTED / UNTESTED dependency resolution |
| Hardhat 3 registry, issuer permissions, immutable revocation | Yes | Contract test file authored, **not run** | IMPLEMENTED / UNTESTED |
| Contract deployment, authorization and ABI export | Yes | Local RPC unavailable, not deployed | BLOCKED BY CONFIGURATION |
| EIP-712 signing, typed credential, digest and signature checking | Yes | Vitest tests authored, **not run** | IMPLEMENTED / UNTESTED |
| Exact PDF creation and SHA-256 | Yes | Vitest tests authored, **not run** | IMPLEMENTED / UNTESTED |
| PDF-only public proof lookup and browser-side verifier | Yes | Edge Function not deployed; on-chain checks not run | BLOCKED BY CONFIGURATION |
| Supabase schema, role constraints, RLS, Storage policies | Yes | Migration/test SQL authored, **not executed** | IMPLEMENTED / UNTESTED |
| University/student authentication and one-time record claiming | Yes | Hosted Supabase not configured | BLOCKED BY CONFIGURATION |
| Wallet-binding and independently authenticated P-256 public key | Yes | Edge Function not deployed | BLOCKED BY CONFIGURATION |
| Ephemeral P-256 ECDH/HKDF/AES-256-GCM package | Yes | WebCrypto tamper unit test authored, **not run** | IMPLEMENTED / UNTESTED |
| Student encrypted delivery and original PDF download | Yes | No live university/student accounts | BLOCKED BY CONFIGURATION |
| Holder wallet challenge and atomic single-use consumption | Yes | WebCrypto/signature unit + SQL replay test authored, **not run** | IMPLEMENTED / UNTESTED |
| React role-specific pages, responsive UI | Yes | TSX syntax parsed; **Vite build not executed** | IMPLEMENTED / UNTESTED |
| Issuance recovery, pending reconciliation, delivery retry | Yes | Tests not executed against live services | IMPLEMENTED / UNTESTED |
| Demo reset for one explicitly identified demo institution | Yes | Not executed (destructive, requires Supabase) | IMPLEMENTED / UNTESTED |
| PDF tampering and signed-field tampering | Unit test files authored | Not executed | NOT TESTED |
| Unauthorized issuer and duplicate registration | Contract tests authored | Not executed | NOT TESTED |
| Genuine revocation changes verification verdict | Manual workflow authored | Not executed | NOT TESTED |
| Stolen certificate / unrelated holder wallet | Signature test and API code authored | Not executed | NOT TESTED |
| Encrypted ciphertext tampering | WebCrypto test authored | Not executed | NOT TESTED |
| Student/institution isolation, role escalation, public enumeration | Transactional SQL test authored | Not executed | NOT TESTED |
| End-to-end issuer → student → employer workflow | Code assembled | Requires Mac + hosted Supabase + MetaMask | NOT TESTED |

## Genuine generator environment commands and results

- `node --version` → **v22.16.0** (meets Hardhat 3 Node minimum).
- `node scripts/staticcheck.mjs` → **PASS: 44 TypeScript/TSX/JSON source files parsed, 0 syntax diagnostics**. This is not a typecheck or a working build.
- `node scripts/check-config.mjs` → **Supabase web/.env absent, contract not deployed, no npm modules, local RPC offline** (as expected in generation environment).
- `npm install --package-lock-only --offline --ignore-scripts --no-audit --no-fund` → **FAIL `ENOTCACHED`** for registry.npmjs.org. Network DNS also unavailable. A lockfile was **not fabricated**.
- `npm run build`, `npm run test`, `npm run test:contracts`, `supabase db push`, Edge Function deploy, transaction tests and browser smoke tests → **NOT RUN** (external dependencies unavailable).

## Known risks / incomplete validation

1. **Highest priority**: install with internet on your Mac; resolve any package/version issues; generate the actual npm lockfile and run typechecking, Vite build, Solidity compile and tests. Correct real errors rather than declaring source syntax sufficient.
2. Hosted Supabase migration and Edge Functions are not deployed. RLS, GRANTs, private Storage and trusted challenge handling must be tested with separate real accounts. Example SQL RLS test is for a disposable project.
3. Metamask/local node state, deployed address, UI route actions, supported browsers, wallet signing and exact full issuance-to-verification path are untested.
4. Public proof retrieval and ownership APIs do not yet include distributed rate limiting, observability, or production abuse prevention; suitable only for restricted local assessment.
5. A failed PDF upload can leave a pre-chain pending issuance needing new issuance/recovery; a pending record with no chain registration cannot be reconciled as on-chain registered. Recovery is partial.
6. Holder private P-256 keys are browser/device-local; no cross-device recovery or key rotation in v1.
7. No production public chain, public verification URL, W3C VC interoperability, PAdES signing or independent security audit claimed.
8. Dependency manifests use compatible **proposed** version ranges and have no validated lockfile until `npm install` succeeds.

## Immediate next action

On the Apple Silicon Mac in the extracted repository folder run only:

```bash
node --version
npm --version
npm install
```

Share the full output if installation reports an error. Once dependencies are installed, run tests in stages, record actual results here, and fix the smallest affected module.
