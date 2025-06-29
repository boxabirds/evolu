# Phase 0: Multi-Owner Design Document

## Problem Statement

Evolu currently supports only a single owner (user) per database. This limitation prevents:
- Sharing data between users
- Creating collaborative spaces
- Building team features
- Implementing proper group functionality

## Design Goals

1. **Enable multiple independent owners in a single database**
2. **Maintain data isolation between owners**
3. **Support controlled data sharing**
4. **Preserve existing single-owner performance**
5. **Ensure backward compatibility**

## Core Concepts

### Owner Types

```typescript
type Owner = {
  type: "Owner";
  id: OwnerId;
  mnemonic: string;
  writeKey: Uint8Array;
};

type SharedOwner = {
  type: "SharedOwner";
  id: OwnerId;
  mnemonic: string;
  writeKey: Uint8Array;
};
```

### Data Partitioning

Each row in user tables includes an `ownerId`:
- Queries automatically filter by owner context
- Mutations include owner information
- Sync respects owner boundaries

## Architecture Changes

### Current Architecture (Single Owner)

```
┌─────────────┐
│   Evolu     │
├─────────────┤
│  Database   │ ← Single owner owns entire DB
├─────────────┤
│    Sync     │ ← Syncs all data
├─────────────┤
│   Relay     │ ← No owner awareness
└─────────────┘
```

### New Architecture (Multi-Owner)

```
┌─────────────────────────┐
│        Evolu            │
├─────────────────────────┤
│       Database          │
│ ┌─────┐ ┌─────┐ ┌─────┐│ ← Partitioned by owner
│ │Own1 │ │Own2 │ │Shared││
│ └─────┘ └─────┘ └─────┘│
├─────────────────────────┤
│         Sync           │ ← Owner-aware sync
├─────────────────────────┤
│        Relay           │ ← Routes by owner
└─────────────────────────┘
```

## Database Design

### Schema Changes

```sql
-- User tables get ownerId column
CREATE TABLE todo (
  id TEXT PRIMARY KEY,
  ownerId BLOB NOT NULL,      -- NEW: Owner of this row
  title TEXT,
  completed INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL,
  -- ... other columns
  FOREIGN KEY (ownerId) REFERENCES evolu_owner(id)
);

-- Owner registry (new system table)
CREATE TABLE evolu_owner (
  id BLOB PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('app', 'shared')),
  mnemonic TEXT,              -- Encrypted with user's key
  writeKey BLOB,              -- Encrypted with user's key
  createdAt INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_todo_owner ON todo(ownerId);
CREATE INDEX idx_evolu_owner_type ON evolu_owner(type);
```

### Query Patterns

```typescript
// Before: All queries return all data
db.selectFrom("todo").selectAll()

// After: Queries filtered by active owner
db.selectFrom("todo")
  .where("ownerId", "=", activeOwner.id)
  .selectAll()

// Cross-owner query (with permissions)
db.selectFrom("todo")
  .where("ownerId", "in", authorizedOwnerIds)
  .selectAll()
```

## API Design

### Evolu API Extensions

```typescript
interface Evolu {
  // Owner management
  createSharedOwner(): SharedOwner;
  addSharedOwner(mnemonic: string): Result<SharedOwner, Error>;
  listOwners(): Array<Owner | SharedOwner>;
  setActiveOwner(owner: Owner | SharedOwner): void;
  
  // Owner-aware mutations
  insert<T>(table: string, row: T, options?: { owner?: Owner | SharedOwner }): void;
  update<T>(table: string, row: T, options?: { owner?: Owner | SharedOwner }): void;
  delete(table: string, id: Id, options?: { owner?: Owner | SharedOwner }): void;
  
  // Owner-aware queries
  createQuery<T>(query: QueryBuilder, options?: { owner?: Owner | SharedOwner }): Query<T>;
}
```

### Usage Examples

```typescript
// Create a shared space
const sharedOwner = evolu.createSharedOwner();

// Insert data into shared space
evolu.insert("todo", { 
  title: "Team task" 
}, { 
  owner: sharedOwner 
});

// Query shared data
const sharedTodos = evolu.createQuery(
  (db) => db.selectFrom("todo").selectAll(),
  { owner: sharedOwner }
);

// Switch active owner context
evolu.setActiveOwner(sharedOwner);
// Now all operations default to sharedOwner
```

## Sync Protocol Changes

### Message Format

```typescript
// Before
interface SyncMessage {
  timestamp: string;
  mutations: Mutation[];
}

// After
interface SyncMessage {
  ownerId: string;        // NEW: Owner context
  timestamp: string;
  mutations: Mutation[];
}
```

### Relay Behavior

1. **Connection**: Client identifies which owners it has
2. **Routing**: Messages routed only to clients with matching owner
3. **Security**: Verify writeKey for each owner independently

## Security Model

### Owner Isolation

- Each owner has independent writeKey
- Queries cannot cross owner boundaries without explicit permission
- Mutations verified against owner's writeKey

### Shared Owner Access

- Shared owners use mnemonic for key exchange
- Adding shared owner requires mnemonic
- Each client maintains local copy of shared owner keys

## Migration Strategy

### Existing Databases

```typescript
async function migrateToMultiOwner(evolu: Evolu) {
  // 1. Add ownerId columns to all tables
  await evolu.alterSchema((schema) => {
    schema.alterTable("todo").addColumn("ownerId", "blob");
    // ... for all user tables
  });
  
  // 2. Set default owner for existing rows
  const appOwner = await evolu.getAppOwner();
  await evolu.updateAll("todo", { ownerId: appOwner.id });
  
  // 3. Create owner registry
  await evolu.createSystemTable("evolu_owner");
  
  // 4. Register app owner
  await evolu.registerOwner(appOwner);
}
```

### Backward Compatibility

- Single-owner apps continue working unchanged
- OwnerId defaults to app owner if not specified
- Old sync messages upgraded with app owner id

## Performance Considerations

### Indexes

- Add index on ownerId for all user tables
- Composite indexes for common query patterns

### Query Optimization

- Owner filtering pushed down to SQLite
- Prepared statements for owner queries
- Query plan caching per owner

### Sync Optimization

- Partition sync queues by owner
- Parallel sync for different owners
- Owner-specific change tracking

## Testing Requirements

### Unit Tests

```typescript
describe("Multi-owner support", () => {
  test("data isolation between owners", async () => {
    const owner1 = evolu.createSharedOwner();
    const owner2 = evolu.createSharedOwner();
    
    evolu.insert("todo", { title: "Owner 1 task" }, { owner: owner1 });
    evolu.insert("todo", { title: "Owner 2 task" }, { owner: owner2 });
    
    const todos1 = await evolu.query(todoQuery, { owner: owner1 });
    const todos2 = await evolu.query(todoQuery, { owner: owner2 });
    
    expect(todos1).toHaveLength(1);
    expect(todos2).toHaveLength(1);
    expect(todos1[0].title).toBe("Owner 1 task");
    expect(todos2[0].title).toBe("Owner 2 task");
  });
});
```

### Integration Tests

- Multi-client sync with shared owners
- Owner permission enforcement
- Migration from single to multi-owner

### E2E Tests

- Real relay with multiple connections
- Cross-client shared data updates
- Conflict resolution with multiple owners

## Future Considerations

### Phase 1: Groups

With multi-owner support, groups become:
- Special type of shared owner
- Additional metadata (name, members, roles)
- Permission system on top of owner isolation

### Advanced Features

- Owner-specific encryption keys
- Selective sync (only sync active owners)
- Owner quotas and limits
- Cross-owner references (with permissions)

## Summary

This design enables multiple independent owners within a single Evolu database while maintaining:
- Strong data isolation
- Backward compatibility
- Good performance
- Clear security boundaries

The implementation focuses on concrete database and API changes rather than abstract interfaces, ensuring a working foundation for the Groups feature.