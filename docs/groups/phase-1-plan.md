# Phase 1 Implementation Plan: Groups for Evolu

## Overview

This plan details the implementation tasks for extending Evolu with group support. The approach maximizes code reuse (70-80%) while adding powerful multi-user features through incremental changes.

## Prerequisites ✅

Phase 0 refactoring is complete:
- [x] Security abstractions created
- [x] CRDT decoupled from owner system
- [x] Protocol supports auth abstractions
- [x] All tests passing with new abstractions

## Implementation Features & Tasks

### 1. Group Security Foundation

**Create core group abstractions**
- [ ] Create `GroupSecurityContext.ts` implementing `SecurityContext`
  - [ ] Generate group-specific NodeIds including epoch
  - [ ] Implement partition key as `group:{groupId}:{epoch}`
  - [ ] Add metadata for group information
  - [ ] **Tests**: Context creation, NodeId generation, partition keys

- [ ] Create `GroupAuthProvider.ts` implementing `AuthProvider`
  - [ ] Multi-member signature creation
  - [ ] Signature verification with member public keys
  - [ ] Role-based permission checks
  - [ ] **Tests**: Signature creation/verification, role validation

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

**Extend platform packages**
- [ ] React hooks (`packages/react`)
  - [ ] `useGroup()` - Current group state
  - [ ] `useGroupMembers(groupId)` - Member list
  - [ ] `useGroups()` - All user's groups
  - [ ] Extend `useQuery()` for context awareness
  - [ ] **Tests**: Hook behavior, re-render optimization

- [ ] Svelte stores (`packages/svelte`)
  - [ ] `groupStore` - Current group
  - [ ] `groupsStore` - All groups
  - [ ] Context-aware query stores
  - [ ] **Tests**: Store reactivity, subscriptions

- [ ] Update TypeScript exports
  - [ ] Export new group types
  - [ ] Update index files
  - [ ] Maintain backward compatibility
  - [ ] **Tests**: Type exports, no breaking changes

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

## Notes

- Keep changes additive - no modifications to existing owner system
- Test continuously - ensure backward compatibility
- Document as you go - keep examples updated
- Get feedback early - demo working features