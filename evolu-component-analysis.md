# Evolu Component Analysis for Groups System Refactoring

## Executive Summary

After analyzing the Evolu codebase, I've identified several components that can be refactored and reused for the groups system rather than requiring a complete rebuild. The core architecture is well-designed with good separation of concerns, making it feasible to swap out the owner-based security model for a groups-based one.

## Component Analysis

### 1. Query System (Highly Reusable - 90%)

**Location**: `packages/common/src/Evolu/Query.ts`, `Kysely.ts`

**Current State**:
- Type-safe SQL query builder using Kysely
- Query serialization/deserialization 
- Query caching and subscription system
- No direct coupling to owner system

**Refactoring Required**:
- None for core functionality
- May need to add group-aware query context for access control

**Verdict**: **KEEP AND REUSE** - This is architecturally sound and owner-agnostic

### 2. Storage Layer (Moderately Reusable - 70%)

**Location**: `packages/common/src/Evolu/Storage.ts`

**Current State**:
- SQLite abstraction with Skiplist implementation
- Owner-based partitioning in `evolu_timestamp` table
- Owner-specific methods like `validateWriteKey`, `setWriteKey`

**Refactoring Required**:
- Replace `ownerId` with `groupId` in table schema
- Replace owner-specific validation with group membership validation
- Add group-specific tables for membership and permissions
- Modify fingerprinting to work with group-based partitioning

**Verdict**: **REFACTOR** - Core skiplist and storage logic is solid, just needs security model swap

### 3. Sync Infrastructure (Highly Reusable - 85%)

**Location**: `packages/common/src/Evolu/Sync.ts`, `Relay.ts`

**Current State**:
- WebSocket-based sync with clean abstraction
- Message routing is owner-agnostic at transport level
- Protocol handlers are separate from transport

**Refactoring Required**:
- Update relay storage to handle group authorization
- Modify message routing to consider group boundaries
- Add group membership sync capabilities

**Verdict**: **KEEP AND REUSE** - Transport layer is clean and reusable

### 4. Schema System (Highly Reusable - 95%)

**Location**: `packages/common/src/Evolu/Schema.ts`

**Current State**:
- Type-safe schema definitions
- Mutation validation and size limits
- Owner is passed as option, not baked into schema

**Refactoring Required**:
- Update `MutationOptions` to accept group context instead of owner
- Add group-specific schema validations if needed

**Verdict**: **KEEP AND REUSE** - Excellently designed, minimal changes needed

### 5. Event System (Fully Reusable - 100%)

**Location**: `packages/common/src/Store.ts`

**Current State**:
- Generic pub/sub store implementation
- Used for query subscriptions and state management
- No owner-specific logic

**Refactoring Required**:
- None

**Verdict**: **KEEP AS-IS** - Perfect separation of concerns

### 6. Platform Abstractions (Fully Reusable - 100%)

**Location**: `packages/common/src/Evolu/Platform.ts`, platform-specific packages

**Current State**:
- Clean abstractions for Web Workers, SharedWorkers, React Native
- Platform-specific implementations in separate packages
- No owner-specific logic in abstractions

**Refactoring Required**:
- None for abstractions
- Platform implementations may need updates for group-specific features

**Verdict**: **KEEP AS-IS** - Well-designed platform abstraction layer

## Components Requiring Major Changes

### 1. Protocol Layer

**Location**: `packages/common/src/Evolu/Protocol.ts`

**Issues**:
- Deeply coupled to owner-based authentication
- WriteKey validation baked into protocol
- Message structure assumes single owner per message

**Recommendation**: Create new `GroupProtocol.ts` that maintains RBSR sync but with group-based auth

### 2. Security Abstractions

**Location**: `packages/common/src/Evolu/SecurityAbstractions.ts`, `OwnerAdapters.ts`

**Issues**:
- Built around owner/writeKey model
- Encryption tied to owner keys

**Recommendation**: Create new `GroupSecurityAbstractions.ts` with group key management

### 3. Main Evolu API

**Location**: `packages/common/src/Evolu/Evolu.ts`

**Issues**:
- Public API assumes owner-based model
- Initialization requires owner creation

**Recommendation**: Create `EvoluGroups.ts` with group-aware API while reusing internal components

## Recommended Refactoring Strategy

### Phase 1: Create Parallel Abstractions
1. Create `GroupSecurityAbstractions.ts` for group-based security
2. Create `GroupProtocol.ts` for group-aware sync protocol
3. Create `GroupStorage.ts` extending base storage with group tables

### Phase 2: Refactor Core Components
1. Update Storage layer to use group abstractions
2. Modify Schema system to accept group context
3. Update Sync infrastructure for group message routing

### Phase 3: New Public API
1. Create `EvoluGroups.ts` as new entry point
2. Reuse Query, Schema, Store, and Platform components
3. Implement group-specific features (invites, permissions, etc.)

## Architecture Insights

### Strengths to Preserve:
1. **Dependency Injection Pattern**: Makes swapping implementations easy
2. **Type Safety**: Excellent use of TypeScript branded types
3. **Separation of Concerns**: Most components have single responsibilities
4. **Platform Abstraction**: Clean separation of platform-specific code

### Areas for Improvement:
1. **Security Model Abstraction**: Could benefit from a more pluggable security model
2. **Protocol Flexibility**: Protocol could be more modular for different auth schemes
3. **Storage Interface**: Could be more generic to support different partitioning strategies

## Conclusion

The Evolu codebase is well-architected with good separation of concerns. Approximately **70-80% of the code can be reused** for a groups-based system. The main work involves:

1. Creating new security abstractions for groups
2. Updating the protocol for group-based authentication
3. Modifying storage to handle group partitioning
4. Creating a new public API while reusing most internal components

This is a much better approach than a complete rewrite, as the core algorithms (CRDT, RBSR sync, query system) are solid and battle-tested.