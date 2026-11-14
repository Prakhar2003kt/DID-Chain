# DID-Chain v1 implementation notes

- Single Vite/React/TypeScript application, Hardhat 3 Solidity AccessControl contract, hosted Supabase Auth/Postgres/private Storage/Edge Functions.
- EIP-712 domain: `name=DID-Chain`, `version=1`, `chainId=31337`, `verifyingContract=deployed registry address`.
- Exact typed struct: `Credential(bytes32 certId,address issuer,address holder,string institution,string studentName,string qualification,uint256 issuedAt,uint256 expiresAt,bytes32 pdfSha256,bytes32 salt)`.
- The final human-readable PDF is hashed (`SHA-256`) **after** generation. The PDF bytes are saved without modifying them after hashing. The signature/digest are off-document and can be looked up by exact PDF hash.
- `digest=ethers.TypedDataEncoder.hash(domain,types,credential)` is registered by the signing issuer on Hardhat. Registry stores digest→issuer/registration timestamp/revoked. An employer needs only the PDF, public proof endpoint, and access to local chain RPC; no employer MetaMask or JSON upload.
- Browser verifies hash, issuer signature, institution data, domain/contract and live on-chain record. Deterministic verdict precedence: `INVALID > REVOKED > UNTRUSTED ISSUER > EXPIRED > VALID`; unavailable required dependencies yield `VERIFICATION UNAVAILABLE` rather than a success.
- Student wallet link uses single-use server challenge and EIP-191 `signMessage`. Separate nonextractable browser P-256 ECDH key authenticated through linked wallet; server verifies binding and accepts P-256 public key. Each delivery uses fresh ephemeral P-256 ECDH → HKDF-SHA256 → AES-256-GCM, authenticated data includes certificate ID and recipient.
- Student downloads original exact PDF after decryption, SHA-256 and signature check, with independent verification of current chain status.
- Holder proof is separately challenged with server-generated nonce, contextual verifier, 2-minute expiry and atomic single-use consumption in PostgreSQL. An authentic PDF does NOT prove physical identity.
- Hosted Edge Functions deliberately only access Supabase, not local Hardhat RPC. Browser JSON-RPC provider reads the local chain for employer verification.

## Trust and limitations

Academic prototype, not production-certified. Local chain is not independently decentralized. Institution approval is administrator managed. Database operator can see plaintext metadata; university retains the PDF. No PAdES PDF signature or generic W3C VC interoperability. A compromised issuer or holder wallet weakens trust. Browser key loss may cause loss of access to encrypted deliveries. TLS of a public website would authenticate the server but does not replace credential verification. Public proof and holder endpoints need real distributed rate limiting, audit logging, operational access policies and security assessment before internet exposure.
