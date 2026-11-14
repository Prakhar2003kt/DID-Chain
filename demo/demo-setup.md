# Local demo preparation and recovery

Use a **dedicated Supabase demo project**. A local Hardhat chain is disposable. Stopping and restarting `hardhat node` loses contract state by default. Never claim a stale record is registered after a chain reset.

1. Start `npm run chain` and leave its Terminal window open.
2. In another Terminal run `npm run deploy`. The deployed contract address and ABI are exported into `web/src/generated/deployment.json`.
3. In MetaMask, add a local network `http://127.0.0.1:8545`, chain ID `31337`. Only import disposable *Hardhat test* keys shown by your own local node; never use a real funded wallet or recovery phrase.
4. With the node's **admin account**, authorize the chosen *issuer* wallet using the documented `authorizeIssuer` interaction (see `MANUAL_SETUP.md`).
5. Bootstrap the institution and university login in Supabase SQL Editor with `is_demo = true` and the **exact** authorized issuer wallet.
6. Sign up one student; university creates a student record and shares its single-use claim code. Student claims, links MetaMask and creates encryption key.
7. Issue a credential and use the public `/verify` route. For live negative demonstrations edit the PDF bytes (INVALID), then revoke original digest (REVOKED).

## When the local blockchain is reset

The old on-chain evidence is gone even if hosted Supabase still has a record. Clear ONLY your demo university records using `scripts/reset-demo.mjs`, then redeploy and issue fresh certificates. Script requires all of:

```bash
export DIDCHAIN_DEMO_UNIVERSITY_ID='the-uuid-of-your-demo-institution'
export SUPABASE_URL='https://YOURPROJECT.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='read-from-your-Supabase-dashboard-for-this-one-process'
npm run demo:reset -- --confirm-demo-reset
unset SUPABASE_SERVICE_ROLE_KEY
```

The reset deletes matching **demo credential records and the demo storage paths** in the configured project; it does not delete student accounts or claimed student records. It refuses to run if any selected credentials are not marked demo. Remove service keys from shell history as appropriate; better load through your secret manager rather than typing inline.

Local Vite employer verification works only on the same machine running Hardhat. A hosted Edge Function cannot access the Mac's localhost RPC. This is expected and designed around.
