# Forward Secrecy Design for Evolu Groups

## Overview

Forward secrecy ensures that if a group's encryption key is compromised, historical messages remain secure. This is achieved through epoch-based key rotation where each epoch has its own encryption key.

## Key Concepts

### Epoch
A time period with a unique encryption key. When the epoch changes:
- New messages use the new key
- Old messages remain encrypted with old keys
- Members can decrypt messages from epochs they were part of

### Epoch Rotation Triggers
1. **Time-based**: Every N days
2. **Member changes**: When members join/leave
3. **Manual**: Admin-triggered rotation
4. **Compromise**: When a key leak is suspected

## Architecture

### Epoch Manager
```typescript
interface EpochManager {
  // Current epoch for encryption
  readonly currentEpoch: Epoch;
  
  // Get key for specific epoch
  getEpochKey(epoch: EpochId): Promise<EpochKey | null>;
  
  // Rotate to new epoch
  rotateEpoch(reason: RotationReason): Promise<NewEpoch>;
  
  // Check if member had access during epoch
  canAccessEpoch(memberId: UserId, epoch: EpochId): boolean;
}
```

### Storage Schema
```sql
-- Epoch metadata
CREATE TABLE evolu_epoch (
  "groupId" TEXT NOT NULL,
  "epochId" INTEGER NOT NULL,
  "startedAt" TEXT NOT NULL,
  "endedAt" TEXT,
  "keyHash" BLOB NOT NULL, -- For verification
  PRIMARY KEY ("groupId", "epochId")
);

-- Member epoch access
CREATE TABLE evolu_epoch_member (
  "groupId" TEXT NOT NULL,
  "epochId" INTEGER NOT NULL,
  "memberId" TEXT NOT NULL,
  "encryptedKey" BLOB NOT NULL, -- Key encrypted for member
  PRIMARY KEY ("groupId", "epochId", "memberId")
);
```

### Message Structure with Epochs
```typescript
interface EpochAwareMessage {
  groupId: GroupId;
  epochId: EpochId;
  timestamp: Timestamp;
  encryptedContent: Uint8Array;
  // No key material in message!
}
```

## Key Distribution

### Approach 1: Encrypted Key per Member
Each member stores the epoch key encrypted with their public key:
```typescript
interface MemberEpochKey {
  epochId: EpochId;
  encryptedKey: Uint8Array; // Encrypted with member's public key
  memberPublicKey: PublicKey;
}
```

**Pros**: Simple, secure, members control their keys
**Cons**: O(n) storage per epoch rotation

### Approach 2: Key Derivation Tree (Simplified MLS)
Use a tree structure where members can derive epoch keys:
```typescript
interface KeyTree {
  root: TreeNode;
  memberLeaves: Map<UserId, LeafNode>;
  
  deriveEpochKey(epoch: EpochId, memberKey: PrivateKey): EpochKey;
}
```

**Pros**: O(log n) updates, elegant
**Cons**: Complex, requires careful implementation

### Recommendation: Start with Approach 1
Given the target of "small group chat" (12-15 people), the O(n) overhead is acceptable and the implementation is much simpler.

## Sync Considerations

### Cross-Epoch Sync
```typescript
interface EpochAwareSync {
  // Can sync messages from multiple epochs
  syncMessages(
    fromEpoch: EpochId, 
    toEpoch: EpochId
  ): AsyncIterable<EpochMessage>;
  
  // Verify member had access
  verifyEpochAccess(
    memberId: UserId,
    epochIds: EpochId[]
  ): Map<EpochId, boolean>;
}
```

### Handling Missing Epochs
If a member was offline during epoch rotation:
1. They request missing epoch keys from active members
2. Keys are encrypted with their public key
3. They can then decrypt historical messages

## Implementation Challenges

### 1. Epoch Boundary Messages
Messages sent during epoch rotation need careful handling:
```typescript
interface EpochTransition {
  // Messages in flight during rotation
  handleTransitionMessage(msg: Message): Promise<void>;
  
  // Grace period for old epoch
  gracePeriodMs: number;
}
```

### 2. Storage Overhead
Each epoch requires:
- Epoch metadata (~100 bytes)
- Key per member (~256 bytes * members)
- For 15 members: ~4KB per rotation

### 3. Performance Impact
```typescript
interface DecryptionPerformance {
  // Cache decrypted epoch keys
  epochKeyCache: LRUCache<EpochId, EpochKey>;
  
  // Batch decrypt messages from same epoch
  batchDecrypt(messages: EpochMessage[]): Promise<Decrypted[]>;
}
```

## Security Properties

### What Forward Secrecy Provides
- ✅ Past messages secure if current key compromised
- ✅ Removed members can't decrypt future messages
- ✅ Limited damage from key compromise

### What It Doesn't Provide
- ❌ Protection if device is compromised (has all keys)
- ❌ Protection against malicious current members
- ❌ Message deletion/disappearing messages (separate feature)

## Integration with Evolu

### Minimal Changes Required
1. Add `epochId` to messages
2. Extend `EncryptionProvider` with epoch support
3. Add epoch tables to schema
4. Update sync to handle epochs

### Backward Compatibility
```typescript
// Owner-based (no epochs)
type OwnerMessage = { ownerId: OwnerId; content: Encrypted };

// Group-based (with epochs)  
type GroupMessage = { groupId: GroupId; epochId: EpochId; content: Encrypted };

// Protocol handles both
type Message = OwnerMessage | GroupMessage;
```

## Simplified Implementation Plan

### Phase 1: Basic Epochs (No Rotation)
- Single epoch per group
- Lay groundwork for future rotation
- Test epoch-aware encryption/decryption

### Phase 2: Manual Rotation
- Admin can trigger rotation
- Handle epoch transitions
- Distribute new keys

### Phase 3: Automatic Rotation
- Time-based triggers
- Member change triggers
- Graceful handling of offline members

### Phase 4: Optimizations
- Key caching
- Batch operations
- Compact storage

## Conclusion

Forward secrecy through epoch-based key rotation is achievable without rebuilding Evolu. By:
1. Extending existing abstractions
2. Adding epoch awareness to messages
3. Implementing careful key distribution
4. Handling epoch transitions gracefully

We can add this critical security feature while preserving the elegant simplicity of Evolu's architecture.