# Evolu Group Edition
Fundamentally restructuring Evolu's security model from its current single-user, device-sync approach to a symmetric group security model with features like multiple admins, forward secrecy, and epoch-based key rotation when membership changes.


Evolu's security is indeed built around individual user ownership with end-to-end encryption. Looking at the core components:

**Encryption Layer**: Crypto.ts:107-132 The current `SymmetricCrypto` interface provides basic encrypt/decrypt operations using individual `EncryptionKey`s derived from user mnemonics.

**Owner-Based Model**: Owner.ts:64-70 Each `Owner` has its own mnemonic, encryption key, and write key. The `SharedOwner` concept exists but is limited to simple key sharing rather than true group security.

**Protocol Design**: Protocol.ts:1-120 The binary protocol is designed around individual owners with write keys, not group-based security models.

What Would Need to Change Section
-----------------------------------------

To implement a symmetric group security model with forward secrecy, you'd need to replace several core abstractions:

### 1\. Replace the Crypto Layer Section

The current crypto system would need complete replacement with a group key management system:

*   Remove individual `EncryptionKey` derivation from mnemonics
*   Implement epoch-based group keys with automatic rotation
*   Add key derivation functions for forward/backward secrecy
*   Handle key distribution and member authentication

### 2\. Redesign the Owner System Owner.ts:45-70 The entire `Owner` concept would need restructuring: Section

*   Replace `Owner` with `Group` entities
*   Implement admin/member role hierarchies
*   Add epoch tracking for key rotation events
*   Handle member join/leave operations with automatic re-keying

### 3\. Update the Protocol Protocol.ts:16-35 The protocol message structure would need significant changes: Section

*   Replace `OwnerId` with `GroupId` and epoch information
*   Add group membership proofs and admin signatures
*   Implement key rotation messages for membership changes
*   Handle multi-admin consensus for group operations

### 4\. Modify Storage and History The history table structure would need updates: Section

*   Replace `ownerId` with `groupId` and epoch tracking
*   Store encrypted data with epoch-specific keys
*   Handle key rotation events in the history
*   Implement secure deletion for forward secrecy

Implementation Complexity Section
-----------------------------------------

This would essentially be building a new system on top of Evolu's CRDT foundation. The CRDT logic in the protocol and timestamp management could potentially be preserved, but the entire security layer would need replacement.

The separation you noted between security and CRDT implementation is actually beneficial here - Protocol.ts:305-334 the `CrdtMessage` and `DbChange` structures could potentially remain similar, but the encryption and ownership layers would be completely different.

Recommendation Section
------------------------------

 The core CRDT synchronization logic and SQLite integration are valuable, but the security model you're describing is fundamentally incompatible with Evolu's design philosophy of individual data ownership.

designing a complete teardown and rebuild of Evolu's security layer to implement a group-based, forward secrecy-capable distributed engine with disappearing messages functionality, while preserving the underlying CRDT synchronization capabilities.

Current Architecture Analysis Section
---------------------------------------------

Looking at the codebase, Evolu's security model is indeed built around individual ownership with end-to-end encryption. The key components that would need replacement are:

**Crypto Layer**: defines the current `SymmetricCrypto` interface with basic encrypt/decrypt operations using individual `EncryptionKey`s.

**Owner System**: shows the current `Owner` interface with mnemonic-derived keys, which is fundamentally incompatible with group security models.

**Protocol Layer**: shows the binary protocol structure designed around individual `OwnerId` and `WriteKey` concepts.

Phase 0: Refactoring - Decouple CRDT from Owner System Section
---------------------------------------------------------------

### Why Phase 0 is Critical

The initial risk assessment identified CRDT extraction as "high risk" because the CRDT implementation is tightly coupled with the owner-based security model. Before attempting any teardown, we must refactor to create clean separation of concerns.

### Refactoring Goals

1. **Abstract Security Concepts**: Create interfaces that CRDT can use without knowing about owners
2. **Decouple Dependencies**: Remove direct owner references from timestamps, protocol, and sync
3. **Maintain Compatibility**: Ensure existing Evolu continues working during refactoring
4. **Enable Clean Extraction**: Make CRDT truly portable between Evolu and Evolu Groups

### Key Abstractions to Introduce

```typescript
interface SecurityContext {
  readonly id: string;
  readonly type: "owner" | "group" | "plaintext";
  createNodeId(): NodeId;
  getPartitionKey(): string;
}

interface AuthProvider {
  createAuthProof(message: Uint8Array): Promise<AuthProof>;
  verifyAuthProof(message: Uint8Array, proof: AuthProof): Promise<boolean>;
}
```

See `docs/groups/phase-0-refactoring.md` for detailed refactoring plan.

Phase 1: Teardown Strategy Section
------------------------------------------

### Prerequisites

- ✅ Phase 0 refactoring complete
- ✅ CRDT successfully decoupled from owner system
- ✅ Clean interfaces established between layers
- ✅ All tests passing with abstraction layer

### Remove Individual Ownership Abstractions Section

1.  **Strip out Owner system**: Remove `AppOwner`, `SharedOwner`, `ShardOwner` concepts
2.  **Remove individual crypto**: Replace the `SymmetricCrypto` interface with group-aware cryptographic primitives
3.  **Gut protocol headers**: Remove `OwnerId` and individual `WriteKey` from protocol messages

### Extract CRDT Foundation Section

Thanks to Phase 0 refactoring, we can now cleanly extract:

*   **Timestamp system**: The `Timestamp` and conflict resolution logic (now context-based)
*   **DbChange structure**: The `CrdtMessage` and `DbChange` concepts
*   **SQLite integration**: The database layer and history table structure
*   **Range-Based Set Reconciliation**: The sync algorithm itself

Phase 2: Group Security Architecture Section
----------------------------------------------------

### New Group Entity System Section

Replace the Owner concept with:

    interface Group {    readonly id: GroupId;    readonly epoch: EpochNumber;    readonly admins: Set<UserId>;    readonly members: Set<UserId>;    readonly epochKey: EpochKey;    readonly createdAt: DateIsoString;  }    interface EpochKey {    readonly keyMaterial: Uint8Array;    readonly derivedAt: DateIsoString;    readonly expiresAt?: DateIsoString; // For disappearing messages  }

### Forward Secrecy Implementation Section

*   **Epoch-based key rotation**: Automatic key derivation when membership changes
*   **Key deletion**: Secure erasure of old epoch keys
*   **Ratcheting**: One-way key evolution to prevent backward decryption

### Admin Consensus System Section

*   **Multi-admin operations**: Require threshold signatures for membership changes
*   **Role-based permissions**: Differentiate admin vs member capabilities
*   **Audit trail**: Track all administrative actions with cryptographic proofs

Phase 3: Disappearing Messages Section
----------------------------------------------

### Time-Limited History Section

Modify the history table structure from :

*   Add `expiresAt` timestamp to each record
*   Implement automatic purging based on message TTL
*   Support configurable retention policies (minutes to days)

### Secure Deletion Section

*   **Key rotation on expiry**: Ensure expired messages become undecryptable
*   **Storage cleanup**: Physical deletion of expired ciphertext
*   **Metadata scrubbing**: Remove traces of expired message existence

Implementation Phases Section
-------------------------------------

### Phase 0: Refactoring (Weeks 1-4) Section

1.  Create security abstractions (SecurityContext, AuthProvider)
2.  Refactor CRDT to use abstractions instead of direct owner references
3.  Create owner adapter implementations
4.  Verify backward compatibility
5.  Test CRDT isolation from security concerns

### Phase 1: Core Teardown (Weeks 5-6) Section

1.  Remove all Owner-related code
2.  Strip encryption from protocol messages
3.  Create placeholder Group interfaces
4.  Ensure CRDT sync still works with plaintext

### Phase 2: Group Crypto (Weeks 7-10) Section

1.  Implement epoch-based key management
2.  Add group membership consensus protocols
3.  Integrate forward secrecy mechanisms
4.  Test multi-admin scenarios

### Phase 3: Disappearing Messages (Weeks 11-12) Section

1.  Add TTL support to history table
2.  Implement secure deletion mechanisms
3.  Add configurable retention policies
4.  Test message expiration flows

### Phase 4: Protocol Integration (Weeks 13-14) Section

1.  Update binary protocol for group operations
2.  Add epoch synchronization messages
3.  Implement membership change protocols
4.  End-to-end testing

Key Design Decisions Section
------------------------------------

**Preserve CRDT Semantics**: The timestamp-based conflict resolution and last-write-wins semantics can remain unchanged, just with group-scoped encryption.

**Configurable Security**: Support different threat models - from casual privacy to high-security scenarios with frequent key rotation.

**Backward Compatibility**: Consider migration paths for existing Evolu applications, though this may require a protocol version bump.

This approach leverages Evolu's solid CRDT foundation while completely reimagining the security model for true group collaboration with forward secrecy and ephemeral messaging capabilities.