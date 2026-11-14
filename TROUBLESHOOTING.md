# Troubleshooting — targeted first checks

**`npm install` fails** — ensure a live connection to `registry.npmjs.org`, Node >=22.13, and share the exact error; do not replace Hardhat 3 with Hardhat 2. `package-lock.json` should be created from a real successful install.

**`Hardhat not found` / `No modules found`** — run `npm install` at repository root. Workspaces install contract/frontend modules together.

**`Contract not deployed`** — run `npm run chain` in Terminal 1 and `npm run deploy` in Terminal 2. Check `web/src/generated/deployment.json` contains a nonempty address and ABI. Do not hardcode an address from a previous chain run.

**`Wrong network` / `missing contract code`** — select local RPC 127.0.0.1:8545 / chain 31337 in MetaMask. Restarted Hardhat may reset all state. Deploy and re-authorize issuer; clear only demo records before reissuing.

**`Supabase not configured`** — configure `web/.env` using publishable key, not service-role key. Apply migrations, provision actual approved issuer profile, deploy both Edge Functions.

**`Edge Function 401`** — API mode: `verification-api` is public; `identity-api` validates user JWT for privileged actions even though the gateway is public. Ensure a valid Supabase login and proper Edge Function deployment/config (`supabase/config.toml`).

**`Row-level security policy violation`** — university role must be admin approved and institution approved, wallet must correspond; student must claim eligible record. Do not weaken RLS just to clear a 403.

**`Pending credential`** — check whether on-chain digest was actually registered. If yes use History → Reconcile; if no, issuance may require authorized retry or fresh issuance. Never mark a nonregistered digest as registered.

**`Ciphertext authentication error`** — wrong browser device, lost P-256 key, wrong recipient or tampered AES-GCM package. Don't disable integrity checks.

**`Verification unavailable`** — check RPC, chain code, and Supabase proof endpoint. Do not interpret outages as VALID.

**`Certificate INVALID`** — ensure original untouched PDF, exact SHA-256, EIP-712 domain matching deployed address and current chain, recovered signer and on-chain issuer match. Any new PDF save/print can change its hash.

**`Ownership not confirmed`** — student wallet must match credential holder; signed response must be over exact challenge (cert ID/nonce/verifier/expiry) and consumed only once.
