# Refactor vs Teardown Analysis: Maximizing Code Reuse for Groups

## Executive Summary

After analyzing the Evolu codebase, approximately **70-80%** of the existing implementation can be refactored and reused for the groups system. The core algorithms and infrastructure are well-designed and owner-agnostic. Only the security layer needs significant changes.

## Highly Reusable Components (Direct Reuse)

### 1. Query System (Kysely) - 90% Reusable
```typescript
// This works exactly the same for groups!
const query = db
  .selectFrom("todos")
  .where("completed", "=", false)
  .selectAll();
```
- **Why**: Kysely queries don't know about owners
- **Changes**: None needed
- **Benefit**: Type-safe queries work immediately

### 2. CRDT Engine - 100% Reusable (Thanks to Phase 0!)
```typescript
// Phase 0 provides multi-owner foundation
const timestamp = createInitialTimestamp(dataOwner);
```
- **Why**: Phase 0 creates multi-owner data partitioning
- **Changes**: Groups adds collaboration layer on top
- **Benefit**: Battle-tested sync algorithm

### 3. Event System (Store) - 100% Reusable
```typescript
// Generic pub/sub works for any model
export class Store<Value> {
  subscribe(listener: (value: Value) => void): () => void
}
```
- **Why**: Completely generic implementation
- **Changes**: None
- **Benefit**: Reactive updates work immediately

### 4. Platform Adapters - 100% Reusable
- Web Worker implementation
- SharedWorker support
- React Native adapters
- Node.js implementation
- **Why**: These are just runtime environments
- **Changes**: None
- **Benefit**: Multi-platform support from day 1

## Components Needing Adaptation

### 1. Storage Layer - 70% Reusable
Current owner-based:
```typescript
applyMessages(messages: ReadonlyArray<ProtocolMessage>) {
  // Filters by ownerId
}
```

Refactored for groups:
```typescript
applyMessages(messages: ReadonlyArray<ProtocolMessage>) {
  // Filter by groupId and epoch
  const validMessages = messages.filter(msg => 
    this.groupValidator.canApply(msg, this.currentEpoch)
  );
}
```

### 2. Schema System - 95% Reusable
Just add group-specific tables:
```typescript
const evoluGroupsSchema = {
  ...evoluInternalTables, // Reuse internal tables
  evolu_group: table({    // Add group tables
    id: text(),
    currentEpoch: integer(),
  }),
  evolu_epoch: table({
    groupId: text(),
    epoch: integer(),
    keyMaterial: blob(),
  })
};
```

### 3. Sync Protocol - 60% Reusable
- Message transport: 100% reusable
- Binary encoding: 100% reusable  
- Auth verification: Needs group signatures
- Message filtering: Needs epoch awareness

## New Abstraction Strategy

Instead of teardown, create parallel abstractions:

```typescript
// Phase 0: Simple multi-owner foundation
interface MultiOwnerEvolu {
  owners: {
    addDataOwner(ownerId: OwnerId): DataOwner;
    setActiveOwner(owner: DataOwner): void;
  };
  insert(table, data, { owner?: DataOwner }): void;
  createQuery(query, { owner?: DataOwner }): Query;
}

// Phase 1: Groups layer on top
interface GroupEvolu extends MultiOwnerEvolu {
  groups: {
    create(name: string): Group;
    join(invite: GroupInvite): void;
    addMember(groupId, userId): void;
  };
}
```

## Refactoring Plan

### Phase 0: Multi-Owner Foundation (CURRENT)
```typescript
// Create multi-owner foundation:
- MultiOwnerAPI.ts      // API types
- MultiOwnerImpl.ts     // Implementation  
- MultiOwnerEvolu.ts    // Integration
- MultiOwnerMigration.ts // Database migration
```

### Phase 1: Groups Layer (1-2 weeks)
```typescript
// Build groups on multi-owner foundation:
- GroupManager.ts       // Group CRUD operations
- GroupInvites.ts       // Invitation system
- GroupMembers.ts       // Member management
- GroupSecurity.ts      // Access control
```

### Phase 2: Group Database Schema (1 week)
```typescript
// Add group tables on top of multi-owner:
CREATE TABLE evolu_group (
  id TEXT PRIMARY KEY,
  ownerId BLOB NOT NULL,  -- Links to multi-owner system
  name TEXT,
  createdAt TEXT
);

CREATE TABLE evolu_group_member (
  groupId TEXT,
  userId TEXT,
  role TEXT,
  joinedAt TEXT
);
```

### Phase 3: Group API Integration (1 week)
```typescript
// Extend Evolu with group capabilities:
interface GroupEvolu extends MultiOwnerEvolu {
  groups: {
    create(name: string): Promise<Group>;
    join(invite: GroupInvite): Promise<void>;
    addMember(groupId: GroupId, userId: string): Promise<void>;
    
    // All mutations/queries automatically work with groups
    // because they're built on the multi-owner foundation
  };
}
```

## What We DON'T Need to Rebuild

1. **Kysely integration** - Works perfectly
2. **CRDT timestamps** - Already abstracted
3. **Binary encoding** - Protocol buffers work fine
4. **Worker architecture** - Solid foundation
5. **React hooks** - Just need context updates
6. **SQLite integration** - Rock solid
7. **WebSocket sync** - Transport is generic

## Benefits of Refactoring

1. **Faster delivery** - 4 weeks vs 12 weeks
2. **Less risk** - Proven components keep working
3. **Gradual migration** - Both systems can coexist
4. **Better testing** - Can A/B test approaches
5. **Preservation of battle-tested code** - Years of bug fixes retained

## Challenges with Forward Secrecy

The main complexity is epoch-based encryption:

```typescript
interface EpochManager {
  currentEpoch: Epoch;
  
  // Challenge: Efficient key rotation
  rotateEpoch(): Promise<NewEpoch>;
  
  // Challenge: Handling old messages
  decryptFromEpoch(data: Encrypted, epoch: Epoch): Promise<Uint8Array>;
  
  // Challenge: Epoch boundaries
  canSyncAcrossEpoch(from: Epoch, to: Epoch): boolean;
}
```

But this is **orthogonal** to the core Evolu architecture - we can add it without rebuilding everything.

## Recommendation

**Refactor, don't teardown**. The Evolu codebase is well-architected with good separation of concerns. We can:

1. Keep 70-80% of existing code
2. Build multi-owner foundation (Phase 0) - SIMPLE data partitioning
3. Add groups layer on top (Phase 1) - Rich collaboration features
4. Ship faster with less risk
5. Maintain backward compatibility

**Key insight**: We don't need SharedOwner's complexity. Phase 0 creates simple multi-owner data partitioning. Groups adds collaboration on top.

## Next Steps

1. Complete Phase 0 multi-owner foundation (database + API)
2. Build Groups layer on the foundation:
   - Group management (create, join, invite)
   - Member management (add, remove, roles)
   - Security (access control, encryption)
3. Add group tables leveraging multi-owner partitioning
4. Extend sync protocol for group coordination
5. Update public API with group methods

This approach delivers groups in 4-6 weeks instead of 12+, while maintaining code quality and reliability.

**Current Status**: Phase 0 Step 1 (Database) ✅ completed, Step 2 (API) in progress.