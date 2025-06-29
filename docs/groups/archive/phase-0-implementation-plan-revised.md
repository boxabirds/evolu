# Phase 0: Core Multi-Owner Data Partitioning - Revised Plan

## Overview

Phase 0 must implement the fundamental capability for Evolu to support multiple data owners/partitions within a single database. This is a prerequisite for any collaborative features including groups.

**Key principle: NO SharedOwner dependency, NO mocks, REAL end-to-end testing with relay and multiple clients.**

## Current Reality

1. Evolu currently only supports a single AppOwner per database
2. All mutations are tied to this single owner
3. The sync protocol only handles single-owner scenarios
4. SharedOwner exists as a type but has NO implementation
5. Groups feature cannot work without multi-owner support

## Phase 0 Goals

1. **Enable multiple owners in a single database**
   - Each owner has their own data partition
   - Data is cryptographically isolated between owners
   - Sync works correctly with multiple owners

2. **Extend the mutation system**
   - Allow specifying which owner a mutation belongs to
   - Ensure proper encryption with the correct owner's keys
   - Maintain backward compatibility with single-owner apps

3. **Update the sync protocol**
   - Support syncing data from multiple owners
   - Ensure the relay can handle multi-owner scenarios
   - Maintain proper access control

## Implementation Steps

### Step 1: Database Schema Changes

Modify the core Evolu tables to support owner partitioning:

```sql
-- Current: Data is implicitly owned by the single AppOwner
-- New: Add ownerId to all data tables

-- Example for a user's todo table:
CREATE TABLE todo (
  id TEXT PRIMARY KEY,
  ownerId BLOB NOT NULL,  -- NEW: Which owner this row belongs to
  title TEXT,
  isCompleted INTEGER,
  -- ... other columns
  FOREIGN KEY (ownerId) REFERENCES evolu_owner(id)
);

-- Index for efficient owner-based queries
CREATE INDEX idx_todo_owner ON todo(ownerId);
```

### Step 2: Owner Management Table

Create a table to track all owners in the database:

```sql
CREATE TABLE evolu_owner (
  id BLOB PRIMARY KEY,  -- Owner ID (derived from mnemonic)
  type TEXT NOT NULL,   -- 'app', 'shared', 'group'
  encryptionKey BLOB,   -- Public key for verification
  createdAt TEXT NOT NULL,
  metadata TEXT         -- JSON metadata about the owner
);
```

### Step 3: Mutation System Updates

Update the mutation APIs to accept an owner parameter:

```typescript
// Current API:
evolu.insert("todo", { title: "Hello" });

// New API (backward compatible):
evolu.insert("todo", { title: "Hello" }); // Uses default AppOwner

// New API with explicit owner:
evolu.insert("todo", { title: "Hello" }, { 
  owner: groupOwner  // Can be any owner the user has access to
});
```

### Step 4: Query System Updates

Queries must filter by owner:

```typescript
// Current: Returns all todos (implicitly from AppOwner)
const todos = evolu.createQuery((db) => db.selectFrom("todo"));

// New: Still returns AppOwner todos by default
const todos = evolu.createQuery((db) => db.selectFrom("todo"));

// New: Query from specific owner
const groupTodos = evolu.createQuery(
  (db) => db.selectFrom("todo"),
  { owner: groupOwner }
);
```

### Step 5: Sync Protocol Updates

The sync protocol must handle multiple owners:

1. **Message format**: Include owner ID in sync messages
2. **Relay storage**: Partition messages by owner
3. **Access control**: Verify write keys per owner
4. **Subscription**: Subscribe to multiple owners' updates

### Step 6: Encryption Updates

Each owner has its own encryption key:

1. Data is encrypted with the owner's key, not the AppOwner's key
2. The owner's mnemonic/keys must be accessible to decrypt
3. For shared owners, the mnemonic is stored encrypted in the database

## Testing Requirements

### Test Scenario 1: Basic Multi-Owner

```typescript
test("supports multiple owners in single database", async () => {
  // Setup
  const relay = await createTestRelay({ port: 4001 });
  const client1 = await createTestClient({ syncUrl: "http://localhost:4001" });
  
  // Create app owner data
  await client1.insert("todo", { title: "Personal todo" });
  
  // Create a shared space
  const sharedSpace = await client1.createSharedSpace("Work todos");
  
  // Insert into shared space
  await client1.insert("todo", { title: "Work todo" }, { owner: sharedSpace });
  
  // Verify data isolation
  const personalTodos = await client1.query(
    (db) => db.selectFrom("todo")
  );
  expect(personalTodos).toHaveLength(1);
  expect(personalTodos[0].title).toBe("Personal todo");
  
  const workTodos = await client1.query(
    (db) => db.selectFrom("todo"),
    { owner: sharedSpace }
  );
  expect(workTodos).toHaveLength(1);
  expect(workTodos[0].title).toBe("Work todo");
  
  await relay.dispose();
});
```

### Test Scenario 2: Multi-Client Sync

```typescript
test("syncs multi-owner data between clients", async () => {
  const relay = await createTestRelay({ port: 4002 });
  
  // Client 1 creates shared space
  const client1 = await createTestClient({ syncUrl: "http://localhost:4002" });
  const sharedSpace = await client1.createSharedSpace("Shared workspace");
  const inviteCode = await client1.generateInvite(sharedSpace);
  
  // Client 2 joins shared space
  const client2 = await createTestClient({ syncUrl: "http://localhost:4002" });
  await client2.acceptInvite(inviteCode);
  
  // Client 1 inserts data
  await client1.insert("todo", { title: "Shared todo" }, { owner: sharedSpace });
  
  // Wait for sync
  await waitForSync(client2);
  
  // Client 2 should see the data
  const client2Todos = await client2.query(
    (db) => db.selectFrom("todo"),
    { owner: sharedSpace }
  );
  expect(client2Todos).toHaveLength(1);
  expect(client2Todos[0].title).toBe("Shared todo");
  
  // Client 2's personal data remains separate
  const client2Personal = await client2.query(
    (db) => db.selectFrom("todo")
  );
  expect(client2Personal).toHaveLength(0);
  
  await relay.dispose();
});
```

### Test Scenario 3: Access Control

```typescript
test("enforces access control for multi-owner data", async () => {
  const relay = await createTestRelay({ port: 4003 });
  
  // Client 1 creates private shared space
  const client1 = await createTestClient({ syncUrl: "http://localhost:4003" });
  const privateSpace = await client1.createSharedSpace("Private workspace");
  
  // Client 1 inserts data
  await client1.insert("todo", { title: "Private todo" }, { owner: privateSpace });
  
  // Client 2 (not invited) cannot access
  const client2 = await createTestClient({ syncUrl: "http://localhost:4003" });
  
  // Client 2 should not see the private space data
  const client2Todos = await client2.query(
    (db) => db.selectFrom("todo"),
    { owner: privateSpace } // This should fail or return empty
  );
  expect(client2Todos).toHaveLength(0);
  
  // Relay should not sync private data to unauthorized clients
  await waitForSync(client2);
  
  // Still no access after sync attempt
  const client2TodosAfterSync = await client2.query(
    (db) => db.selectFrom("todo"),
    { owner: privateSpace }
  );
  expect(client2TodosAfterSync).toHaveLength(0);
  
  await relay.dispose();
});
```

### Test Scenario 4: Relay Handling

```typescript
test("relay correctly partitions multi-owner messages", async () => {
  const relay = await createTestRelay({ port: 4004 });
  
  // Three clients, two share a space
  const client1 = await createTestClient({ syncUrl: "http://localhost:4004" });
  const client2 = await createTestClient({ syncUrl: "http://localhost:4004" });
  const client3 = await createTestClient({ syncUrl: "http://localhost:4004" });
  
  // Client 1 creates shared space and invites client 2
  const sharedSpace = await client1.createSharedSpace("Shared");
  const inviteCode = await client1.generateInvite(sharedSpace);
  await client2.acceptInvite(inviteCode);
  
  // Track what each client receives
  const client1Messages: any[] = [];
  const client2Messages: any[] = [];
  const client3Messages: any[] = [];
  
  client1.onSyncMessage((msg) => client1Messages.push(msg));
  client2.onSyncMessage((msg) => client2Messages.push(msg));
  client3.onSyncMessage((msg) => client3Messages.push(msg));
  
  // Client 1 writes to shared space
  await client1.insert("todo", { title: "Shared item" }, { owner: sharedSpace });
  
  // Wait for relay to process
  await waitForSync([client1, client2, client3]);
  
  // Client 1 and 2 should receive the shared space update
  expect(client1Messages.some(m => m.ownerId === sharedSpace.id)).toBe(true);
  expect(client2Messages.some(m => m.ownerId === sharedSpace.id)).toBe(true);
  
  // Client 3 should NOT receive the shared space update
  expect(client3Messages.some(m => m.ownerId === sharedSpace.id)).toBe(false);
  
  await relay.dispose();
});
```

## Success Criteria

Phase 0 is complete when:

1. **Multiple owners work**: A single database can contain data from multiple owners
2. **Data is isolated**: Each owner's data is encrypted with their own keys
3. **Sync works**: The relay correctly handles multi-owner scenarios
4. **Access control works**: Only authorized users can access each owner's data
5. **All tests pass**: Including multi-client relay tests
6. **No mocks**: All tests use real implementations
7. **Backward compatible**: Existing single-owner apps continue to work

## Non-Goals for Phase 0

- No group management UI or APIs (that's Phase 1)
- No fancy invite systems (that's Phase 1)
- No role-based permissions (that's Phase 1)
- No SharedOwner type usage (we implement the capability, not the type)

## Migration Strategy

1. New apps automatically get multi-owner support
2. Existing apps continue to work with single owner
3. Existing apps can opt-in to multi-owner with a migration
4. The database version is bumped to indicate multi-owner support

## Next Steps After Phase 0

Only after Phase 0 is fully implemented and tested:
- Phase 1 can build group management on top of multi-owner capability
- Phase 2 can add advanced features like key rotation
- Phase 3 can optimize performance for large groups

## Key Differences from Original Plan

1. **No SharedOwner**: We implement multi-owner capability directly, not through SharedOwner type
2. **Real relay tests**: Every feature must be tested with actual relay and multiple clients
3. **No mocks**: All tests use real implementations
4. **End-to-end focus**: Tests verify actual user scenarios, not implementation details
5. **Access control from day 1**: Security is not an afterthought