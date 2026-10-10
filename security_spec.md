# Security Specification — CHANDRA TANI DESAKU

## 1. Data Invariants
1. **Identity Isolation (`userId`)**: Every document in `/users/{userId}`, `/field_blocks/{blockId}`, `/harvest_records/{harvestId}`, and `/activity_history/{historyId}` must belong strictly to the authenticated user (`userId == request.auth.uid`) and require `request.auth.token.email_verified == true`.
2. **PII Protection**: `/users/{userId}` contains farmer phone and profile details; `get` and `write` are strictly isolated to `request.auth.uid == userId`. No `list` operation is permitted on `/users`.
3. **Strict Schema & Volumetric Bounds**: Every string field enforces `.size() <= maxLength` matching `firebase-blueprint.json`. No shadow/ghost fields are allowed (`keys().hasOnly(...)`).
4. **Temporal & Ownership Immutability**: `userId` and `createdAt` cannot be mutated during `update`. Timestamp fields (`createdAt`, `updatedAt`) must equal `request.time`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth == null` attempting to create `/harvest_records/h1`.
2. **Unverified Email Spoof**: `auth.token.email_verified == false` attempting to create `/users/u1`.
3. **Cross-Tenant Identity Spoofing**: User `u1` creating `/harvest_records/h1` with `userId: "u2"`.
4. **Shadow/Ghost Field Injection**: Creating `/field_blocks/b1` with extra key `isAdmin: true`.
5. **ID Poisoning Attack**: Document ID exceeding 128 chars or containing invalid characters (`$`, `/`, spaces).
6. **Denial-of-Wallet String Overflow**: `summary` in `/activity_history/a1` exceeding 2000 characters.
7. **PII Blanket Read Attempt**: User `u2` attempting `get` on `/users/u1`.
8. **Unauthorized List Scraping**: User `u1` querying `/harvest_records` without filtering `resource.data.userId == request.auth.uid`.
9. **Ownership Transfer on Update**: Updating `userId` on `/field_blocks/b1` from `"u1"` to `"u2"`.
10. **Client Timestamp Forgery**: Setting `createdAt` to a past/future timestamp instead of `request.time`.
11. **Invalid Enum Injection**: Creating `/activity_history/a1` with `category: "hacked_category"`.
12. **Type Confusion Attack**: Updating `soilMoisture` in `/field_blocks/b1` with a string `"99%"` instead of a number.
