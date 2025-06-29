# Phase 0: Multi-Owner Implementation Plan

## Overview

Phase 0 establishes the foundation for multi-owner support in Evolu, enabling multiple independent data owners within a single database. This is required for Groups functionality.

## Goals

1. **Enable multiple owners in one database**
2. **Partition data by owner**
3. **Update sync protocol for multi-owner support**
4. **Maintain backward compatibility**
5. **Test with real relay and multiple clients**

## Implementation Steps

### Step 1: Database Schema Changes

Add owner tracking to all user tables:

```sql
-- Add ownerId column to track which owner each row belongs to
ALTER TABLE user_table ADD COLUMN ownerId BLOB NOT NULL;

-- Create index for efficient owner-based queries
CREATE INDEX idx_user_table_owner ON user_table(ownerId);

-- Add owner registry table
CREATE TABLE evolu_owner (
  id BLOB PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('app', 'shared')),
  mnemonic TEXT,
  writeKey BLOB,
  createdAt INTEGER NOT NULL
);
```

### Step 2: API Changes

Update mutation and query APIs to support owner parameter:

```typescript
// Insert with specific owner
evolu.insert("todo", { title: "Task" }, { owner: sharedOwner });

// Query filtered by owner
evolu.createQuery((db) => 
  db.selectFrom("todo")
    .where("ownerId", "=", owner.id)
    .selectAll()
);

// Update with owner context
evolu.update("todo", { id, title: "Updated" }, { owner });
```

### Step 3: Core Module Updates

1. **Db.ts**
   - Add owner parameter to insert/update/delete
   - Filter queries by current owner context
   - Handle owner registry operations

2. **Mutation.ts**
   - Include ownerId in all mutations
   - Validate owner context for operations

3. **Query.ts**
   - Automatic owner filtering
   - Cross-owner query support with permissions

### Step 4: Protocol & Sync Updates

1. **Protocol.ts**
   - Include ownerId in sync messages
   - Support owner-based message routing

2. **Sync.ts**
   - Partition sync by owner
   - Only sync data for owners we have access to

3. **Relay Updates**
   - Route messages by ownerId
   - Enforce owner-based access control
   - Support multi-owner websocket connections

### Step 5: Owner Management

Create owner management functions:

```typescript
interface OwnerManager {
  // Create new shared owner
  createSharedOwner(): SharedOwner;
  
  // Add existing shared owner
  addSharedOwner(mnemonic: string): Result<SharedOwner, Error>;
  
  // List all owners in database
  listOwners(): Array<Owner | SharedOwner>;
  
  // Switch active owner context
  setActiveOwner(owner: Owner | SharedOwner): void;
}
```

### Step 6: Migration Support

Handle existing single-owner databases:

```typescript
// Migrate existing data to have ownerId
async function migrateToMultiOwner(db: Database, defaultOwner: Owner) {
  // Add ownerId column if missing
  await db.schema.alterTable("user_table")
    .addColumn("ownerId", "blob")
    .execute();
    
  // Set default owner for existing rows
  await db.updateTable("user_table")
    .set({ ownerId: defaultOwner.id })
    .where("ownerId", "is", null)
    .execute();
}
```

## Testing Strategy

### Unit Tests
- Database operations with multiple owners
- Query filtering by owner
- Protocol message handling
- Owner management operations

### Integration Tests
- Multi-owner sync scenarios
- Access control enforcement
- Migration from single to multi-owner

### E2E Tests
```typescript
test("multi-owner data sharing", async () => {
  // Start relay
  const relay = await startRelay();
  
  // Create two clients
  const client1 = createEvolu();
  const client2 = createEvolu();
  
  // Client 1 creates shared owner
  const shared = await client1.createSharedOwner();
  
  // Client 2 adds shared owner
  await client2.addSharedOwner(shared.mnemonic);
  
  // Client 1 inserts data
  await client1.insert("todo", { title: "Shared task" }, { owner: shared });
  
  // Verify client 2 receives it
  await waitFor(() => {
    const todos = client2.query(todoQuery, { owner: shared });
    expect(todos).toHaveLength(1);
  });
});
```

## Success Criteria

1. **Multiple owners can coexist in one database**
2. **Data is properly partitioned by owner**
3. **Sync works correctly with owner filtering**
4. **No performance regression for single-owner**
5. **All existing tests continue to pass**
6. **E2E tests pass with real relay**

## Timeline

- Step 1-2: Database & API changes (2 days)
- Step 3-4: Core module updates (3 days)
- Step 5: Owner management (1 day)
- Step 6: Migration support (1 day)
- Testing & debugging (3 days)

**Total: ~10 days**

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing apps | Maintain backward compatibility, default to app owner |
| Performance impact | Add indexes, benchmark critical paths |
| Complex migration | Provide automated migration, clear upgrade guide |
| Security concerns | Enforce owner boundaries at all levels |