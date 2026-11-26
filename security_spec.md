# Golden Corral Clean Radio — Security Specification & Invariants

## 1. Data Invariants
1. **Strict RBAC & Self-Registration Safety**: A user creating `/users/{uid}` cannot assign themselves `admin`, `manager`, or `staff` roles—self-creation is restricted to `role == 'subscriber'` unless the verified email matches the bootstrapped admin (`latenightradiorap@gmail.com`). Only an existing Admin can promote or change user roles.
2. **Submission Clean-Edit & Ownership Integrity**: Every `/submissions/{submissionId}` document must have `submitterId == request.auth.uid`, `cleanEditCertified == true`, `audioFormat in ['MP3', 'WAV']`, `status == 'pending'` on creation, and server-verified timestamp `createdAt == request.time`. Submitters cannot self-approve their own tracks.
3. **PII Isolation**: Submitter emails (`submitterEmail`) in `/submissions` and user emails in `/users` are readable only by the document owner or verified Admins/Managers—never by other subscribers. Publicly playable approved tracks are projected into `/approvedTracks` with zero PII.
4. **Immutable Audit Trail**: `/reportActivityLogs/{logId}` entries cannot be updated or deleted by any client role, preserving compliance and access history integrity.
5. **Email Verification Gate**: All authenticated write mutations require `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Yield PERMISSION_DENIED)
1. **Self-Promotion on Sign-Up**: Creating `/users/attacker` with `{ role: 'admin', uid: 'attacker', ... }`.
2. **Role Escalation Update**: Updating `/users/attacker` with `{ role: 'manager' }` as a subscriber.
3. **Shadow Field Injection on Submission**: Creating `/submissions/sub1` with `{ ..., isVerified: true }` (extra key outside allowlist).
4. **Self-Approval Status Shortcut**: Creating `/submissions/sub1` with `{ status: 'approved' }` or updating own submission `{ status: 'approved' }`.
5. **Uncertified Explicit Track**: Creating `/submissions/sub1` with `{ cleanEditCertified: false }`.
6. **Unverified Email Spoofing**: Admin-email token with `email_verified: false` attempting admin read/write.
7. **PII Cross-Read on Submissions**: Subscriber B calling `get` or `list` on `/submissions` owned by Subscriber A.
8. **ID Poisoning**: Creating `/audioZones/../../bad_id` or a 300-character document ID.
9. **Immutable Timestamp Tampering**: Creating a record with `createdAt` in the past instead of `request.time`.
10. **Audit Log Erasure**: Manager or Admin attempting `delete` or `update` on `/reportActivityLogs/log1`.
11. **Volume Out-of-Bounds Poisoning**: Updating `/audioZones/dining` with `{ volume: 9999 }` or `{ volume: "loud" }`.
12. **Blanket List Scraping**: Unauthenticated or non-admin subscriber calling `list` on `/users` or `/submissions` without owner constraint.
