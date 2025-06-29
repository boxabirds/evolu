# Phase 1 Implementation Plan: Groups for Evolu

## Overview

This plan details the implementation tasks for extending Evolu with group support. The approach maximizes code reuse (70-80%) while adding powerful multi-user features through incremental changes.

## Prerequisites ✅

Phase 0 refactoring is complete:
- [x] Security abstractions created
- [x] CRDT decoupled from owner system
- [x] Protocol supports auth abstractions
- [x] All tests passing with new abstractions

## CRITICAL IMPLEMENTATION RULES

### MANDATORY IMPLEMENTATION ORDER

**YOU MUST IMPLEMENT IN THIS EXACT ORDER. DO NOT SKIP AHEAD.**

1. Feature 1 MUST be 100% complete with passing tests before starting Feature 2
2. Feature 2 MUST be 100% complete with passing tests before starting Feature 3
3. Continue sequentially through all features
4. **Feature 6 (Platform Integration) CANNOT be started until Features 1-5 are complete**

**VIOLATION CHECK**: Before starting any feature, verify prerequisites:
```bash
# Before Feature 2: Feature 1 must exist
test -f packages/common/src/Evolu/GroupSecurityContext.ts || echo "STOP: Feature 1 not implemented"

# Before Feature 3: Feature 2 must exist  
test -f packages/common/src/Evolu/GroupSchema.ts || echo "STOP: Feature 2 not implemented"

# Before Feature 6: Features 1-5 must ALL exist
test -f packages/common/src/Evolu/GroupManager.ts || echo "STOP: Cannot do platform integration"
```

### FORBIDDEN PATTERNS (Will indicate you're creating stubs)

❌ **DO NOT** create UI components without backend
❌ **DO NOT** create mock implementations or demos
❌ **DO NOT** write "// TODO: implement later" 
❌ **DO NOT** create files in packages/react or packages/svelte until Feature 6
❌ **DO NOT** create example/demo files
❌ **DO NOT** skip to "what would be visible to users"
❌ **DO NOT** create empty functions or stub methods

✅ **DO** create actual working implementations
✅ **DO** write tests that verify actual functionality
✅ **DO** ensure each component integrates with existing code
✅ **DO** implement complete logic in every method

### What "Implementation" Means

**IMPLEMENTATION** means:
- Code that performs the actual logic
- Integration with existing systems  
- Data persistence/retrieval
- Real security checks
- Actual CRDT operations
- Methods with complete functionality

**STUB/MOCK** means (DO NOT DO THIS):
- Empty functions
- Hardcoded return values
- UI-only implementations
- Demo data
- Placeholder comments
- Methods that don't do anything

## Implementation Features & Tasks

### 1. Group Security Foundation

**REQUIRED DELIVERABLES (Create these exact files with actual implementation):**

#### File: `packages/common/src/Evolu/GroupSecurityContext.ts`
**Minimum 150 lines of WORKING CODE - No stubs!**

```typescript
// THIS IS WHAT YOU MUST IMPLEMENT - COPY AND COMPLETE THIS:
import { SecurityContext, SecurityMetadata } from './SecurityAbstractions.js';
import { GroupId } from './GroupTypes.js'; // You'll need to create this too
import type { EvoluDeps } from './EvoluDeps.js';

export class GroupSecurityContext implements SecurityContext {
  readonly type = 'group' as const;
  readonly id: string;
  readonly metadata: SecurityMetadata;
  
  constructor(
    private readonly group: { 
      id: GroupId; 
      currentEpoch: number;
      name: string;
    },
    private readonly memberId: string,
    private readonly deps: Pick<EvoluDeps, 'nanoid'>
  ) {
    // ACTUAL IMPLEMENTATION - not "// TODO"
    this.id = `group:${group.id}:${group.currentEpoch}`;
    this.metadata = {
      groupId: group.id,
      epoch: group.currentEpoch,
      memberId: this.memberId,
      groupName: group.name,
      type: 'group'
    };
  }
  
  createNodeId(): string {
    // ACTUAL IMPLEMENTATION REQUIRED - This must generate real NodeIds
    const timestamp = Date.now().toString(36);
    const groupPrefix = this.group.id.slice(-8);
    const epochStr = this.group.currentEpoch.toString(36);
    const random = this.deps.nanoid(6);
    return `g${groupPrefix}-e${epochStr}-${timestamp}-${random}`;
  }
  
  getPartitionKey(): string {
    // ACTUAL IMPLEMENTATION REQUIRED
    return `group:${this.group.id}:${this.group.currentEpoch}`;
  }
}
```

**VERIFICATION BEFORE PROCEEDING:**
```bash
# This code MUST work:
cd packages/common
pnpm test GroupSecurityContext.test.ts
# Must show "PASS" with at least 5 tests

# This MUST compile:
pnpm tsc --noEmit
```

- [ ] Create `GroupSecurityContext.ts` implementing `SecurityContext`
  - [ ] Generate group-specific NodeIds including epoch
  - [ ] Implement partition key as `group:{groupId}:{epoch}`
  - [ ] Add metadata for group information
  - [ ] **Tests**: Write `test/GroupSecurityContext.test.ts` with 5+ test cases

#### File: `packages/common/src/Evolu/GroupAuthProvider.ts`
**Minimum 200 lines of WORKING CODE**

```typescript
// ACTUAL IMPLEMENTATION REQUIRED:
import { AuthProvider, AuthProof } from './SecurityAbstractions.js';
import type { GroupMember } from './GroupTypes.js';

export class GroupAuthProvider implements AuthProvider {
  constructor(
    private readonly groupId: string,
    private readonly member: GroupMember,
    private readonly allMembers: Map<string, GroupMember>
  ) {}
  
  async createAuthProof(message: Uint8Array): Promise<AuthProof> {
    // REAL IMPLEMENTATION - Must actually sign the message
    // Use the member's private key to create a signature
    // Include member ID and role in the proof
  }
  
  async verifyAuthProof(message: Uint8Array, proof: AuthProof): Promise<boolean> {
    // REAL IMPLEMENTATION - Must actually verify signatures
    // Check if the signer is a valid group member
    // Verify the signature using member's public key
  }
  
  getPublicIdentifier(): string {
    // Return member's public key or identifier
  }
}
```

- [ ] Create `GroupAuthProvider.ts` implementing `AuthProvider`
  - [ ] Multi-member signature creation
  - [ ] Signature verification with member public keys
  - [ ] Role-based permission checks
  - [ ] **Tests**: Write `test/GroupAuthProvider.test.ts` with 7+ test cases

- [ ] Create `EpochManager.ts` for epoch tracking
  - [ ] Track current epoch per group
  - [ ] Increment epoch (manual only in Phase 1)
  - [ ] Store epoch metadata
  - [ ] Foundation for Phase 2 key rotation
  - [ ] **Tests**: Epoch tracking, increment logic, metadata storage

- [ ] Create `GroupEncryptionProvider.ts` (stub for Phase 1)
  - [ ] Implement interface but no actual encryption
  - [ ] Prepare structure for Phase 2
  - [ ] Document encryption points
  - [ ] **Tests**: Interface compliance, pass-through behavior

## FEATURE 1 COMPLETION CHECKPOINT

**DO NOT PROCEED TO FEATURE 2 UNTIL ALL OF THIS PASSES:**

```bash
# All these files MUST exist and be non-empty:
test -s packages/common/src/Evolu/GroupSecurityContext.ts || exit 1
test -s packages/common/src/Evolu/GroupAuthProvider.ts || exit 1
test -s packages/common/src/Evolu/EpochManager.ts || exit 1
test -s packages/common/src/Evolu/GroupEncryptionProvider.ts || exit 1

# All tests MUST pass:
cd packages/common
pnpm test GroupSecurityContext.test.ts  # Must show PASS
pnpm test GroupAuthProvider.test.ts     # Must show PASS
pnpm test EpochManager.test.ts          # Must show PASS
pnpm test GroupEncryptionProvider.test.ts # Must show PASS

# Integration MUST work:
node -e "
  const { GroupSecurityContext } = require('./dist/Evolu/GroupSecurityContext.js');
  const ctx = new GroupSecurityContext({id: 'test', currentEpoch: 1, name: 'Test'}, 'member1', {nanoid: () => 'test'});
  console.log('NodeId:', ctx.createNodeId());
  console.log('Partition:', ctx.getPartitionKey());
"
# Must output valid NodeId and partition key
```

**If ANY of the above fails, you have NOT completed Feature 1.**

### 2. Storage & Schema Extensions

**Extend database with group tables**
- [ ] Create `GroupSchema.ts` with new tables
  - [ ] `evolu_group` - Group metadata
  - [ ] `evolu_group_member` - Membership and roles
  - [ ] `evolu_epoch` - Epoch tracking
  - [ ] `evolu_epoch_key` - Key storage (Phase 2 prep)
  - [ ] **Tests**: Schema validation, table creation

- [ ] Update `evoluInternalTables` to include group tables
- [ ] Ensure additive changes only (no migrations)
- [ ] Add indexes for group queries
- [ ] **Tests**: Backward compatibility, no schema conflicts

### 3. Protocol & Message Handling

**Extend protocol for group messages**
- [ ] Define `GroupProtocolMessage` interface
  - [ ] Include groupId, epochId, memberSignature
  - [ ] Reuse existing `DbChange` format
  - [ ] Add type discriminator
  - [ ] **Tests**: Message structure, serialization

- [ ] Extend message parsing functions
  - [ ] Update `parseProtocolMessage` to handle both types
  - [ ] Add `createGroupProtocolMessage` function
  - [ ] Ensure backward compatibility
  - [ ] **Tests**: Parse both message types, compatibility

- [ ] Update sync to handle group messages
  - [ ] Route messages based on context type
  - [ ] Filter by group membership
  - [ ] Validate epoch boundaries
  - [ ] **Tests**: Message routing, membership filtering, epoch validation

### 4. Group Management

**Core group operations**
- [ ] Create `GroupManager.ts` 
  - [ ] `create(name: string): Promise<Group>`
  - [ ] `join(invite: GroupInvite): Promise<void>`
  - [ ] `leave(groupId: GroupId): Promise<void>`
  - [ ] `addMember(groupId, userId, role): Promise<void>`
  - [ ] `removeMember(groupId, userId): Promise<void>`
  - [ ] `list(): Promise<Group[]>`
  - [ ] `get(groupId): Promise<Group | null>`
  - [ ] **Tests**: All CRUD operations, permission checks

- [ ] Create `GroupInvite` system
  - [ ] Generate invite codes
  - [ ] Validate invites
  - [ ] Handle invite acceptance
  - [ ] **Tests**: Invite generation, validation, expiry

### 5. API Extensions

**Extend Evolu public API**
- [ ] Add group methods to `Evolu` interface
  - [ ] `createGroup(name: string): Promise<Group>`
  - [ ] `joinGroup(invite: GroupInvite): Promise<void>`
  - [ ] `leaveGroup(groupId: GroupId): Promise<void>`
  - [ ] `getCurrentGroup(): Group | null`
  - [ ] `setCurrentGroup(group: Group): void`
  - [ ] `listGroups(): Promise<Group[]>`
  - [ ] **Tests**: API method behavior, error cases

- [ ] Extend mutation methods with context
  - [ ] Add optional `context` parameter
  - [ ] Default to current context (owner or group)
  - [ ] Validate context permissions
  - [ ] **Tests**: Context switching, permission validation

- [ ] Add feature detection
  - [ ] `supportsGroups: boolean` property
  - [ ] Configuration option `enableGroups`
  - [ ] **Tests**: Feature flag behavior, backward compatibility

### 6. Platform Integration

**⚠️ PREREQUISITES CHECK - DO NOT START WITHOUT THESE:**
```bash
# Features 1-5 MUST be complete:
test -f packages/common/src/Evolu/GroupSecurityContext.ts || echo "STOP!"
test -f packages/common/src/Evolu/GroupSchema.ts || echo "STOP!"
test -f packages/common/src/Evolu/GroupProtocolMessage.ts || echo "STOP!"
test -f packages/common/src/Evolu/GroupManager.ts || echo "STOP!"
test -f packages/common/src/Evolu/GroupAPI.ts || echo "STOP!"

# The API must actually work:
cd packages/common
node -e "
  const { createGroupAwareEvolu } = require('./dist/index.js');
  const evolu = createGroupAwareEvolu(/* ... */);
  evolu.createGroup('Test').then(console.log);
"
# Must create an actual group, not throw errors
```

**ONLY AFTER THE ABOVE WORKS:**

**Extend platform packages**
- [ ] React hooks (`packages/react`)
  - [ ] `useGroup()` - Must call real evolu.getGroup()
  - [ ] `useGroupMembers(groupId)` - Must call real evolu.getGroupMembers()
  - [ ] `useGroups()` - Must call real evolu.listGroups()
  - [ ] These must use the ACTUAL API, not mocks
  - [ ] **Tests**: Hook behavior with real backend

- [ ] Svelte stores (`packages/svelte`)
  - [ ] Must subscribe to real evolu group events
  - [ ] Must update when actual groups change
  - [ ] No hardcoded data
  - [ ] **Tests**: Store reactivity with real backend

- [ ] Update TypeScript exports
  - [ ] Export types that actually exist
  - [ ] All imports must resolve
  - [ ] **Tests**: Can import and use all exports

**FORBIDDEN IN THIS PHASE:**
❌ Creating any "demo" components
❌ Creating any mock data
❌ Creating example apps that fake functionality
❌ Writing UI that doesn't connect to real backend

### 7. Documentation

**User and developer docs**
- [ ] API documentation
  - [ ] Document all new methods
  - [ ] Add TypeScript examples
  - [ ] Show migration patterns

- [ ] Getting started guide
  - [ ] Creating first group
  - [ ] Inviting members
  - [ ] Managing permissions

- [ ] Architecture documentation
  - [ ] How groups work
  - [ ] Security model (Phase 1 vs 2)
  - [ ] Design decisions

## Implementation Order

1. **Foundation First**
   - Group security contexts (Feature 1)
   - Database schema (Feature 2)
   - Protocol extensions (Feature 3)

2. **Core Functionality**
   - Group manager (Feature 4)
   - API methods (Feature 5)

3. **Integration**
   - Platform hooks (Feature 6)
   - Documentation (Feature 7)

4. **Quality Assurance**
   - Run all tests continuously
   - Performance benchmarks
   - Integration testing

## Success Metrics

- [ ] 70-80% code reuse achieved
- [ ] Zero breaking changes
- [ ] All existing tests pass
- [ ] All new feature tests pass
- [ ] Performance overhead <5%
- [ ] Groups feature complete
- [ ] Documentation complete

## Next Steps

After Phase 1 completion:
1. Review security model with team
2. Plan Phase 2 encryption implementation
3. Design key distribution protocol
4. Consider advanced features (disappearing messages, etc.)

## Implementation Success Criteria

### You Have SUCCEEDED When:
1. ✅ All core files exist in packages/common/src/Evolu/
2. ✅ Each file contains 100+ lines of actual implementation
3. ✅ All tests pass (minimum 50 new tests total)
4. ✅ Can create, join, and manage real groups programmatically
5. ✅ Data persists to SQLite database
6. ✅ Sync protocol handles group messages
7. ✅ React/Svelte integration uses real backend

### You Have FAILED If:
1. ❌ Created UI before backend exists
2. ❌ Created mock/demo implementations
3. ❌ Skipped to Feature 6 without Features 1-5
4. ❌ Have empty methods or TODO comments
5. ❌ Tests use fake data instead of real implementation
6. ❌ Created example apps that don't use real groups

## Final Verification

After completing ALL features, this MUST work:

```typescript
// This is a REAL test, not a demo:
import { createEvolu } from '@evolu/common';

const evolu = createEvolu(config);
const group = await evolu.createGroup('My Team');
const invite = await evolu.generateGroupInvite(group.id, 'member');

// On another device:
const evolu2 = createEvolu(config);
await evolu2.joinGroup(invite.code);
const groups = await evolu2.listGroups();
console.log(groups); // Must show the joined group

// Both devices can now sync data within the group
```

If the above doesn't work with REAL data persistence and REAL sync, the implementation is incomplete.

## Notes

- Keep changes additive - no modifications to existing owner system
- Test continuously - ensure backward compatibility
- **Implement actual functionality** - no demos, no mocks, no stubs
- Get feedback after REAL features work, not UI mockups