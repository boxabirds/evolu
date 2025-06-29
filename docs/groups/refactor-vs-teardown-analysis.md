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
// Already abstracted in Phase 0
const timestamp = createInitialTimestampWithContext(groupContext);
```
- **Why**: Phase 0 decoupled CRDT from owners
- **Changes**: Just provide GroupSecurityContext
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
// Existing (keep working)
interface OwnerSecurityContext {
  createNodeId(): NodeId;
  encrypt(data: Uint8Array): Promise<Uint8Array>;
}

// New (add alongside)
interface GroupSecurityContext {
  createNodeId(): NodeId;
  encrypt(data: Uint8Array, epoch: Epoch): Promise<Uint8Array>;
  validateEpoch(epoch: Epoch): boolean;
}

// Unified interface
type SecurityContext = OwnerSecurityContext | GroupSecurityContext;
```

## Refactoring Plan

### Phase 1: Create Group Abstractions (1 week)
```typescript
// New files alongside existing:
- GroupSecurityContext.ts
- GroupAuthProvider.ts  
- GroupEncryption.ts
- EpochManager.ts
```

### Phase 2: Adapt Storage Layer (1 week)
```typescript
// Modify applyMessages to handle both:
if (isGroupContext(context)) {
  return this.applyGroupMessages(messages);
} else {
  return this.applyOwnerMessages(messages); // Existing logic
}
```

### Phase 3: Extend Protocol (1 week)
```typescript
// Add group message types:
interface GroupProtocolMessage {
  groupId: GroupId;
  epoch: Epoch;
  signature: GroupSignature;
  changes: DbChange[]; // Reuse existing!
}
```

### Phase 4: Update Public API (1 week)
```typescript
// Add group support to existing API:
interface Evolu {
  // Existing owner methods still work
  
  // New group methods
  joinGroup(invite: GroupInvite): Promise<void>;
  createGroup(name: string): Promise<Group>;
  
  // Mutations now accept group context
  mutate(mutations: Mutations, options?: {
    context?: SecurityContext; // Owner or Group
  }): void;
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
2. Add group abstractions alongside owner abstractions
3. Gradually migrate functionality
4. Ship faster with less risk
5. Maintain backward compatibility if desired

The only "radical" part needs to be the security model - everything else can be evolutionary rather than revolutionary.

## Next Steps

1. Create `GroupSecurityContext` extending Phase 0 abstractions
2. Implement `EpochManager` for forward secrecy
3. Add group tables to schema
4. Extend protocol with group messages
5. Update public API with group methods

This approach delivers groups in 4-6 weeks instead of 12+, while maintaining code quality and reliability.