# DID-Chain v1 — exact local setup guide (Apple Silicon macOS)

These instructions are for the **first run** and require an internet connection to npm and hosted Supabase. No services have been configured by the code generator. Never post private keys, Supabase secret/service-role keys, seed phrases or real credentials in chat.

## 0. Prerequisites

- Node.js `>=22.13.0` (recommend current stable Node 22 LTS or compatible newer release) and npm, Git, VS Code, Chrome, MetaMask. Check `node --version`, `npm --version`, `git --version`.
- A **new disposable Supabase project**, administrator access and a valid Supabase publishable key. Keep all trusted secrets outside frontend files.
- A local development chain used for testing only. Do not put mainnet assets on Hardhat-derived keys.

## 1. Install everything from the repository root

Unzip `DID-Chain.zip`, open the `DID-Chain` folder in VS Code, open VS Code's Terminal and run:

```bash
node --version
npm install
npm run staticcheck
npm run test
npm run test:contracts
npm run build
```

The initial archive cannot contain a genuine npm lockfile because the generation environment had no npm registry access. `npm install` is necessary to resolve packages; commit the **real generated `package-lock.json`** to your Git repository afterward. If the package manager reports a version conflict, share the exact error before changing the stack.

## 2. Start the Hardhat local chain — TERMINAL 1

```bash
npm run chain
```

Leave Terminal 1 open. Its local RPC is `http://127.0.0.1:8545`, chain ID `31337`. Hardhat prints disposable local funded accounts for testing. **Do not use these accounts with real assets.**

## 3. Deploy registry — TERMINAL 2

```bash
npm run deploy
```

This deploys `AcademicCredentialRegistry`, exports its actual ABI and address to `web/src/generated/deployment.json`, and prints the deployer/admin address. Do not edit the generated contract address by hand.

In MetaMask, configure a **custom local test network**: RPC `http://127.0.0.1:8545`, chain ID `31337`, currency ETH. Import only a **disposable** issuer account from Terminal 1 (e.g., one of the accounts distinct from admin). The admin controls issuer authorization on-chain. Keep separate student and attacker test accounts.

After choosing the issuer address in MetaMask, in Terminal 2:

```bash
export ISSUER_WALLET='0xYOUR_DISPOSABLE_ISSUER_ADDRESS'
npm run authorize:issuer
unset ISSUER_WALLET
```

This calls `authorizeIssuer` using the local node's default admin account. Inspect terminal output for the real transaction hash.

## 4. Configure Supabase, database and Edge Functions — TERMINAL 2

1. Create a new hosted Supabase project in the dashboard. Copy **Project URL** and **publishable key** from Project Settings → API Keys (legacy `anon` also works if available).
2. Copy `web/.env.example` to `web/.env` and replace the URL and publishable key. The local RPC URL stays `http://127.0.0.1:8545`. Never place a service key in a `VITE_` variable.
3. Authenticate with the Supabase CLI and link the correct project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`db push` applies `supabase/migrations/202611040001_initial.sql` (schema, RLS, storage buckets and privileges). Verify there are no migration errors. Supabase CLI may prompt for the database password; enter it locally, **not in this chat**.

4. Configure the allowed frontend origin for Edge Function CORS and deploy both functions:

```bash
npx supabase secrets set PUBLIC_APP_ORIGIN=http://127.0.0.1:5173
npx supabase functions deploy verification-api
npx supabase functions deploy identity-api
```

Both are intentionally public at the gateway (`verify_jwt = false`). `identity-api` independently validates actual signed-in user JWTs for privileged operations. `verification-api` provides only exact-PDF-hash proof lookup. Edge functions receive the hosted project's server credentials securely; those secrets must NEVER be browser-visible.

5. Supabase Dashboard → Authentication → URL Configuration: set Site URL `http://127.0.0.1:5173` and allow appropriate local redirects. With email confirmation enabled, new users must confirm their email before login.

## 5. Bootstrap university account (manual trusted administrator procedure)

First register a normal user using DID-Chain's login page or Supabase Dashboard → Authentication → Users. Its profile starts as `student`. In **Supabase SQL Editor** as the project administrator, run the following, replacing all uppercase placeholders with real values:

```sql
insert into public.universities(name, issuer_wallet, approved, is_demo)
values ('DID-Chain Demo University', '0xYOUR_AUTHORIZED_ISSUER_ADDRESS', true, true)
returning id;

-- Only AFTER replacing the example email with your university account email.
update public.profiles set role='university', university_id=(
 select id from public.universities where name='DID-Chain Demo University'
) where id=(select id from auth.users where email='YOUR_UNIVERSITY_LOGIN_EMAIL');
```

Do **not** allow the web registration form to choose university permissions. This manual bootstrap has administrator-only authority. Confirm the `profiles` row was updated for exactly the intended account. The university account's linked MetaMask address must match both the Supabase institution record and on-chain authorized issuer wallet.

## 6. Student enrollment and issuer workflow

1. Register a separate student Supabase user (and confirm their email, if needed).
2. Log in with the **university** account, open `Students`, add a record, and copy its UUID and one-time enrollment code. Store and share it privately.
3. Log in as the **student**, open `My identity`, claim the record using UUID + code, connect the intended student MetaMask test wallet, and bind its fresh P-256 encryption key in this browser.
4. Return to university account, connect the **authorized issuer wallet**, issue a certificate for this claimed student. MetaMask prompts for a genuine EIP-712 signature and genuine on-chain transaction.
5. Student opens their dashboard, downloads their private encrypted package and decrypts the original PDF.
6. In a normal browser tab open `http://127.0.0.1:5173/verify` and upload that exact PDF to independently verify it without MetaMask.
7. Demonstrate tampering by changing a copy of the original PDF's bytes, then verify copy to receive INVALID. Revoke the original certificate in university `History` and verify the original unchanged PDF again to receive REVOKED.
8. For holder ownership, verifier generates a challenge JSON. Student signs it from their dashboard and returns the signed response to the verifier. Replay the same response to confirm single-use rejection.

## 7. Start the React app — TERMINAL 3

```bash
npm run check
npm run dev
```

Open `http://127.0.0.1:5173`. Terminal 1 (Hardhat) must stay running. Hosted Supabase requires internet. `npm run check` reports missing configuration, offline RPC and stale contract address.

## 8. Recovery

- MetaMask wrong chain: select your local network `31337`; do not attempt to sign on mainnet.
- `VERIFICATION UNAVAILABLE`: check Hardhat node is running, ABI/address exported, and hosted proof endpoint reachable. An unavailable required service is not a valid proof.
- Issuance pending: use `History → Reconcile` after verifying the exact digest exists on-chain; do not create a duplicate transaction. The original PDF is saved before chain registration.
- Encrypted delivery failed: use `History → Retry encrypted delivery` (retrieves exact original PDF and validates its hash).
- Chain restarted: redeploy, clear disposable *demo* database/storage with `demo/demo-setup.md`, re-authorize issuer, and issue fresh credentials.
- Browser storage erased: the non-extractable decryption key is lost; v1 has no automatic key recovery.

## 9. Before claiming the project is finished

Run `npm run test`, `npm run test:contracts`, `npm run build`, check RLS policy enforcement against **real signed-in accounts** in Supabase, and rehearse issuance → delivery → independent verification → tamper rejection → revocation. Record genuine pass/fail outputs in `IMPLEMENTATION_STATUS.md`.
