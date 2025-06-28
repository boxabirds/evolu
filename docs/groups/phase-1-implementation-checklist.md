# Phase 1 Implementation Checklist

## Phase 0 Verification (Prerequisites)

Before starting Phase 1, verify Phase 0 refactoring is complete:

- [ ] **Security Abstractions Created**
  - [ ] `SecurityContext` interface defined
  - [ ] `AuthProvider` interface defined  
  - [ ] `EncryptionProvider` interface defined
  - [ ] `PartitionStrategy` interface defined

- [ ] **CRDT Decoupled**
  - [ ] No direct `Owner` imports in CRDT modules
  - [ ] Timestamps use `SecurityContext` instead of `Owner`
  - [ ] Protocol uses abstract auth instead of `WriteKey`
  - [ ] Sync uses partition strategy instead of owner filtering

- [ ] **Adapters Implemented**
  - [ ] `OwnerSecurityContext` adapter works
  - [ ] `OwnerAuthProvider` adapter works
  - [ ] All existing tests pass with adapters

- [ ] **Isolation Verified**
  - [ ] CRDT works with mock security contexts
  - [ ] No regression in performance
  - [ ] Clean module boundaries established

## Pre-Implementation Tasks

- [ ] Create new repository or package: `@evolu/groups`
- [ ] Set up clean development environment
- [ ] Import refactored CRDT modules from Phase 0
- [ ] Set up fresh test infrastructure
- [ ] Verify CRDT works with plaintext security context

## Step 1: Create Abstraction Layer (Day 1-2)

### Files to Create
- [ ] `packages/common/src/Evolu/GroupAbstraction.ts`
  - [ ] Define `SecurityContext` interface
  - [ ] Define `PlaintextContext` implementation
  - [ ] Create adapter functions

- [ ] `packages/common/src/Evolu/PlaintextCrypto.ts`
  - [ ] Implement no-op `SymmetricCrypto`
  - [ ] Add debug logging for Phase 1

### Files to Modify
- [ ] `packages/common/src/Evolu/Schema.ts`
  - [ ] Add `context?: SecurityContext` to `MutationOptions`
  - [ ] Mark `owner` as deprecated

## Step 2: Protocol Changes (Day 3-4)

### Files to Modify
- [ ] `packages/common/src/Evolu/Protocol.ts`
  - [ ] Define `DbChangeV2` interface
  - [ ] Add `contextId` field
  - [ ] Create compatibility types
  - [ ] Update serialization to handle both formats

- [ ] `packages/common/src/Evolu/Internal.ts`
  - [ ] Update types to use `SecurityContext`

## Step 3: Database Schema (Day 5-6)

### Fresh Schema Definition
- [ ] `schema/001_evolu_groups_schema.sql`
  ```sql
  -- New clean schema without owner concepts
  CREATE TABLE evolu_history (...);
  CREATE TABLE evolu_group (...);
  CREATE TABLE evolu_group_member (...);
  ```

### Files to Create (Clean Implementation)
- [ ] `packages/groups/src/Db.ts`
  - [ ] Implement `createInitialTables` with new schema
  - [ ] Implement `applyMessageToHistory` with contextId
  - [ ] Use `PlaintextCrypto` throughout

## Step 4: Core Evolu Changes (Day 7-8)

### Files to Modify
- [ ] `packages/common/src/Evolu/Evolu.ts`
  - [ ] Remove `ownerStore` initialization
  - [ ] Update `createMutation` to ignore owner parameter
  - [ ] Add `getSecurityContext()` method (returns plaintext)
  - [ ] Deprecate `getAppOwner()`, `resetAppOwner()`, `restoreAppOwner()`

- [ ] `packages/common/src/Evolu/Public.ts`
  - [ ] Update public type exports
  - [ ] Add deprecation notices

## Step 5: Build Clean Implementation (Day 9-10)

### New Files to Create
- [ ] `packages/groups/src/EvoluGroups.ts`
  - [ ] Fresh API implementation
  - [ ] No owner concepts

- [ ] `packages/groups/src/Db.ts`
  - [ ] Clean worker implementation
  - [ ] Context-based operations only

- [ ] `packages/groups/src/Protocol.ts`
  - [ ] New protocol without owner fields
  - [ ] Simple context-based messages

## Step 6: Update Tests (Day 11-12)

### Test Files to Modify
- [ ] `packages/common/test/Evolu.test.ts`
  - [ ] Remove owner-related tests
  - [ ] Add plaintext operation tests
  - [ ] Verify CRDT still works

- [ ] `packages/common/test/Protocol.test.ts`
  - [ ] Update protocol tests for new format
  - [ ] Add compatibility tests

### New Test Files
- [ ] `packages/common/test/GroupAbstraction.test.ts`
- [ ] `packages/common/test/PlaintextCrypto.test.ts`

## Step 7: Platform Updates (Day 13)

### New Platform Packages
- [ ] `packages/groups-react/src/hooks.ts`
  - [ ] Create `useEvoluGroups`
  - [ ] Create `useSecurityContext`

### Other New Packages
- [ ] Create `packages/groups-nodejs`
- [ ] Create `packages/groups-react-native`
- [ ] Create `packages/groups-svelte`

## Step 8: Documentation (Day 14)

### Documentation to Update
- [ ] Update README with Phase 1 changes
- [ ] Create migration guide
- [ ] Document breaking changes
- [ ] Add deprecation timeline

### New Documentation
- [ ] `docs/groups/phase-1-migration.md`
- [ ] `docs/groups/plaintext-warning.md`

## Step 9: Integration Testing (Day 15)

### End-to-End Tests
- [ ] Test migration on example apps
- [ ] Verify sync still works
- [ ] Test rollback procedure
- [ ] Performance benchmarks

### Manual Testing
- [ ] Test with `examples/react-nextjs`
- [ ] Test with `examples/react-native`
- [ ] Verify no data loss

## Phase 1 Completion Criteria

### Code Complete
- [ ] All owner-specific code removed or deprecated
- [ ] Plaintext crypto implemented
- [ ] Protocol supports contextId
- [ ] Database schema updated

### Tests Pass
- [ ] All existing tests updated
- [ ] New abstraction tests pass
- [ ] Migration tests pass
- [ ] Rollback tests pass

### Documentation
- [ ] Breaking changes documented
- [ ] Migration guide complete
- [ ] API deprecations marked

### Sign-off
- [ ] Code review complete
- [ ] Performance acceptable
- [ ] No security regressions (everything plaintext as expected)
- [ ] Ready for Phase 2

## Post-Phase 1 Tasks

- [ ] Merge to main branch
- [ ] Tag release as `v3.0.0-phase1`
- [ ] Announce breaking changes
- [ ] Begin Phase 2 planning

## Risk Tracking

| Task | Risk Level | Mitigation Status |
|------|------------|-------------------|
| Owner removal | High | |
| Protocol changes | High | |
| Database migration | Critical | |
| Test updates | Medium | |
| Platform updates | Medium | |

## Notes Section

_Add implementation notes, blockers, and decisions here as work progresses_