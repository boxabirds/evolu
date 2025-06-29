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

### Multi-Owner Foundation

Phase 0 creates the foundation for multiple data owners without the flawed SharedOwner concept:

```typescript
// App owner (existing)
type AppOwner = {
  type: "AppOwner";
  id: OwnerId;
  mnemonic: string;
  writeKey: Uint8Array;
};

// Simple data owner concept (foundation for Groups)
interface DataOwner {
  type: "app" | "group";
  id: OwnerId;
}
```

**Key insight**: We don't need complex owner types. Groups will provide the collaboration layer on top of this simple multi-owner foundation.

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

-- Owner registry (updated system table)
CREATE TABLE evolu_owner_v2 (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('app', 'group')),
  mnemonic TEXT,              -- For app owner only
  encryptionKey BLOB,         -- For app owner only
  writeKey BLOB,              -- For app owner only
  createdAt TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  addedAt TEXT NOT NULL
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
interface MultiOwnerEvolu {
  // Low-level owner management (Groups will provide higher-level APIs)
  owners: {
    getAppOwner(): AppOwner;
    addDataOwner(ownerId: OwnerId): Result<DataOwner, OwnerError>;
    listOwners(): Array<{ owner: AppOwner | DataOwner; addedAt: string }>;
    setActiveOwner(owner: AppOwner | DataOwner): void;
  };
  
  // Owner-aware mutations
  insert<T>(table: string, row: T, options?: { owner?: AppOwner | DataOwner }): void;
  update<T>(table: string, row: T, options?: { owner?: AppOwner | DataOwner }): void;
  delete(table: string, id: Id, options?: { owner?: AppOwner | DataOwner }): void;
  
  // Owner-aware queries
  createQuery<T>(query: QueryBuilder, options?: { 
    owner?: AppOwner | DataOwner | Array<AppOwner | DataOwner>;
    includeAllOwners?: boolean;
  }): Query<T>;
}
```

### Usage Examples

```typescript
// Phase 0 provides low-level multi-owner foundation
// Groups will provide the high-level collaboration APIs

// Register a data owner (Groups will do this automatically)
const groupOwner = evolu.owners.addDataOwner("group_abc123" as OwnerId);

// Insert data with specific owner
evolu.insert("todo", { 
  title: "Task" 
}, { 
  owner: groupOwner 
});

// Query data from specific owner
const ownerTodos = evolu.createQuery(
  (db) => db.selectFrom("todo").selectAll(),
  { owner: groupOwner }
);

// Query data from multiple owners
const allTodos = evolu.createQuery(
  (db) => db.selectFrom("todo").selectAll(),
  { includeAllOwners: true }
);

// Switch active owner context
evolu.owners.setActiveOwner(groupOwner);
// Now all operations default to groupOwner
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

### Multi-Owner Access

- Each owner has independent data partition
- App owner handles encryption/decryption for all data
- Groups layer will add proper sharing mechanics on top of this foundation

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
    const owner1 = evolu.owners.addDataOwner("owner1" as OwnerId);
    const owner2 = evolu.owners.addDataOwner("owner2" as OwnerId);
    
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

- Multi-client sync with multiple data owners
- Owner-based data isolation enforcement
- Migration from single to multi-owner

### E2E Tests

- Real relay with multiple connections
- Multi-owner data partitioning
- Conflict resolution across owners

## Future Considerations

### Phase 1: Groups

With multi-owner support, groups become:
- High-level collaboration layer built on DataOwner foundation
- Rich metadata (name, members, roles, permissions)
- Proper sharing mechanics with encryption and access control

### Advanced Features

- Owner-specific encryption keys
- Selective sync (only sync active owners)
- Owner quotas and limits
- Cross-owner references (with permissions)

## Summary

This design enables multiple independent data owners within a single Evolu database while maintaining:
- Strong data isolation
- Backward compatibility
- Good performance
- Clear security boundaries

**Key Insight**: Phase 0 creates a simple multi-owner foundation without the complexity of SharedOwner. Groups will add the collaboration layer (invites, members, permissions, encryption) on top of this solid foundation.

**What Phase 0 IS**: Database partitioning by owner + basic owner management APIs
**What Phase 0 IS NOT**: Collaboration features, sharing mechanisms, or complex owner types

The implementation focuses on concrete database and API changes rather than abstract interfaces, ensuring a working foundation for the Groups feature.