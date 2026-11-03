# CNIDARIA wallet-first implementation contract

Status: **design and acceptance criteria only — not a deployed wallet**.

## Non-negotiable product behavior
- Guests can play invitations and RSVP without accounts or wallets.
- Wallet onboarding is opt-in until audited; once enabled, create on device without email, password, or pre-existing wallet.
- Show a verified 12-word BIP-39 backup and require confirmation before valuable assets can be received.
- Never transmit or log mnemonic, seed, xprv, or private key. Never place secrets in a URL, analytics, Supabase, GitHub, or plain localStorage.
- Recovery phrase is not a password reset: losing it and the encrypted vault means irreversible loss.
- Warn that clearing browser storage or changing devices can destroy an unbacked-up wallet.
- Wallets are unlimited identities, **not** unique humans; rate-limit invitations and delay/restrict rewards.
- No token issuance until key derivation, signing, recovery, wallet compatibility, and on-chain transactions are independently tested.

## Protocol choices requiring verification
- BIP-39 English wordlist (2048 words), 128-bit CSPRNG entropy, 4 checksum bits, 12 words; NFKD + PBKDF2-HMAC-SHA512 2048 rounds to 64-byte seed.
- BIP-32 hierarchical secp256k1 key derivation and a **documented BSV wallet-compatible derivation path**, not a guessed path.
- Wallet protocol compatibility and token protocol compatibility are separate. BRC-100 is not a replacement for BIP-39 or BIP-32.
- Locally encrypted vault (authenticated encryption AES-GCM) with a strong user unlock secret and a memory-hard KDF where supported; no default insecure fallback.
- Explicit, signed challenge with domain separation, nonce, expiration and replay protection before binding a wallet to an invitation.
- Public wallet identifier should be separate from private meetup details. No public chain entries for private locations, contact info, or dating activity.

## Release blockers / tests
1. Reproduce BIP-39 reference test vectors and checksum-invalid phrase rejection.
2. Reproduce BIP-32 vectors, and prove expected BSV addresses/signatures against independent implementation.
3. Verify wallet restore on a second device reproduces the same address.
4. Verify wrong unlock secret cannot decrypt, vault tampering fails, and no secret is transmitted.
5. Verify no account or seed is accidentally created for casual guest invite recipients.
6. Verify signed RSVPs are rejected if replayed, modified, expired, or signed by a different wallet.
7. Verify Sybil controls: 100 fresh wallets cannot claim 100 meetup rewards from one encounter.
8. Verify token mint/transfer on test infrastructure and cap enforcement before mainnet.
9. Independent security review before holding assets with monetary value.

## Next implementation slice
Build an isolated, tested wallet library using pinned audited dependencies, encrypted local vault, recovery onboarding, restore flow, and signing verification. Do not integrate into production until all cryptographic test vectors and recovery checks pass.
