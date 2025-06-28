# Phase 1: Architecture Transformation

## Prerequisites: Phase 0 Refactoring

Before Phase 1 can begin, Phase 0 refactoring must be complete:
- ✅ Security abstractions (SecurityContext, AuthProvider) defined
- ✅ CRDT decoupled from owner system
- ✅ Owner adapters implementing abstractions
- ✅ All tests passing with new abstractions
- ✅ Clean separation verified between CRDT and security layers

See `docs/groups/phase-0-refactoring.md` for details.

## Before: Owner-Based Architecture

```mermaid
graph TB
    subgraph "Application Layer"
        App[Application Code]
        EvoluAPI[Evolu API]
    end
    
    subgraph "Security Layer"
        Owner[Owner System]
        Crypto[Symmetric Crypto]
        Keys[Key Derivation]
    end
    
    subgraph "Sync Layer"
        CRDT[CRDT Engine]
        Protocol[Binary Protocol]
        Sync[Sync Algorithm]
    end
    
    subgraph "Storage Layer"
        SQLite[(SQLite)]
        History[evolu_history<br/>with ownerId]
    end
    
    App --> EvoluAPI
    EvoluAPI --> Owner
    Owner --> Crypto
    Owner --> Keys
    
    EvoluAPI --> CRDT
    CRDT --> Protocol
    Protocol --> Sync
    
    Crypto --> History
    CRDT --> SQLite
    
    style Owner fill:#f99
    style Crypto fill:#f99
    style Keys fill:#f99
```

## After Phase 1: Plaintext Foundation

```mermaid
graph TB
    subgraph "Application Layer"
        App[Application Code]
        EvoluAPI[Evolu API]
    end
    
    subgraph "Abstraction Layer"
        Context[Security Context]
        Plaintext[Plaintext Crypto]
    end
    
    subgraph "Sync Layer"
        CRDT[CRDT Engine]
        Protocol[Binary Protocol V2]
        Sync[Sync Algorithm]
    end
    
    subgraph "Storage Layer"
        SQLite[(SQLite)]
        History[evolu_history<br/>with contextId]
        Groups[evolu_group<br/>empty placeholder]
    end
    
    App --> EvoluAPI
    EvoluAPI --> Context
    Context --> Plaintext
    
    EvoluAPI --> CRDT
    CRDT --> Protocol
    Protocol --> Sync
    
    Plaintext -.->|No encryption| History
    CRDT --> SQLite
    
    style Context fill:#ff9
    style Plaintext fill:#ffd
    style Groups fill:#ddd
```

## Component State Transitions

### Removed Components
```mermaid
stateDiagram-v2
    [*] --> OwnerSystem: Current
    OwnerSystem --> Deprecated: Phase 1
    Deprecated --> Removed: Phase 2
    
    [*] --> MnemonicKeys: Current
    MnemonicKeys --> Deprecated: Phase 1
    
    [*] --> SymmetricCrypto: Current
    SymmetricCrypto --> PlaintextStub: Phase 1
    PlaintextStub --> GroupCrypto: Phase 2
```

### Preserved Components
```mermaid
stateDiagram-v2
    [*] --> CRDTEngine: Current
    CRDTEngine --> CRDTEngine: Unchanged
    
    [*] --> Timestamps: Current
    Timestamps --> Timestamps: Unchanged
    
    [*] --> SyncAlgorithm: Current
    SyncAlgorithm --> SyncAlgorithm: Unchanged
```

## Data Flow Transformation

### Current Data Flow
```mermaid
sequenceDiagram
    participant App
    participant Evolu
    participant Owner
    participant Crypto
    participant DB
    
    App->>Evolu: insert(table, data)
    Evolu->>Owner: Get encryption key
    Owner->>Crypto: Encrypt with owner key
    Crypto->>DB: Store encrypted with ownerId
```

### Phase 1 Data Flow
```mermaid
sequenceDiagram
    participant App
    participant Evolu
    participant Context
    participant Plaintext
    participant DB
    
    App->>Evolu: insert(table, data)
    Evolu->>Context: Get security context
    Context->>Plaintext: "Encrypt" (no-op)
    Plaintext->>DB: Store plaintext with contextId
    
    Note over DB: contextId = "plaintext"<br/>No actual encryption
```

## Protocol Evolution

### Message Structure Changes
```typescript
// BEFORE: Owner-based
interface ProtocolMessage {
  ownerId: BinaryOwnerId;
  writeKey: WriteKey;
  changes: DbChange[];
}

// PHASE 1: Context-based
interface ProtocolMessageV2 {
  contextId: string;        // Always "plaintext" in Phase 1
  authProof?: never;        // Removed
  changes: DbChangeV2[];    // Updated structure
}
```

## Database Schema Evolution

### evolu_history Changes
```sql
-- BEFORE
CREATE TABLE evolu_history (
  "ownerId" BLOB NOT NULL,
  "table" TEXT NOT NULL,
  "id" BLOB NOT NULL,
  "column" TEXT NOT NULL,
  "timestamp" BLOB NOT NULL,
  "value" ANY
);

-- PHASE 1 (clean slate)
CREATE TABLE evolu_history (
  "contextId" TEXT NOT NULL,     -- Always "plaintext" in Phase 1
  "table" TEXT NOT NULL,
  "id" BLOB NOT NULL,
  "column" TEXT NOT NULL,
  "timestamp" BLOB NOT NULL,
  "value" ANY                    -- Stored in plaintext
);
```

## API Surface

### Evolu Groups API (New System)
```typescript
// Clean, new API - no legacy methods
interface EvoluGroups {
  insert<T>(table: string, data: T): Result<Id, Error>;
  update<T>(table: string, id: Id, data: T): Result<void, Error>;
  delete(table: string, id: Id): Result<void, Error>;
  query<T>(query: Query<T>): Promise<T[]>;
  sync(): Promise<void>;
  getSecurityContext(): SecurityContext; // { type: "plaintext", id: "plaintext" }
}
```

## Testing Strategy Transformation

### Before: Owner-Centric Tests
```typescript
test("owner can decrypt their data", () => {
  const owner = createAppOwner();
  const encrypted = encrypt(data, owner.encryptionKey);
  const decrypted = decrypt(encrypted, owner.encryptionKey);
  expect(decrypted).toEqual(data);
});
```

### Phase 1: Plaintext Tests
```typescript
test("data flows through plaintext", () => {
  const context = getDefaultSecurityContext();
  const "encrypted" = encrypt(data, context); // No-op
  const "decrypted" = decrypt("encrypted", context); // No-op
  expect("decrypted").toEqual(data);
  expect("encrypted").toEqual(data); // Same!
});
```

## Risk Areas (After Phase 0 Refactoring)

```mermaid
graph LR
    subgraph "High Risk → Low Risk"
        A[CRDT Extraction]
    end
    
    subgraph "Still High Risk"
        B[Protocol Redesign]
        C[Clean API Design]
    end
    
    subgraph "Medium Risk"
        D[New API Design]
        E[Test Creation]
        F[Package Setup]
    end
    
    subgraph "Low Risk"
        G[CRDT Logic]
        H[Sync Algorithm]
        I[SQLite Core]
    end
    
    A -.->|Phase 0 fixes| G
    B --> C
    D --> E
    E --> F
    
    style A fill:#9f9,stroke:#f99,stroke-width:3px,stroke-dasharray: 5 5
    style B fill:#f99
    style C fill:#f99
    style D fill:#ff9
    style E fill:#ff9
    style F fill:#ff9
    style G fill:#9f9
    style H fill:#9f9
    style I fill:#9f9
```

### Risk Mitigation Through Refactoring

**CRDT Extraction**: Originally high risk due to tight coupling with owner system. Phase 0 refactoring introduces abstractions that decouple CRDT from security concerns, reducing this to low risk.

**Why This Matters**:
- Can test CRDT with mock security contexts before extraction
- Clear interfaces prevent accidental coupling during development
- Both Evolu and Evolu Groups benefit from cleaner architecture
- Extraction becomes mechanical rather than architectural

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test Coverage | >90% | Jest coverage report |
| Performance | <5% regression | Benchmark suite |
| Clean Start Success | 100% | Integration tests |
| API Completeness | 100% | All features implemented |
| CRDT Function | 100% preserved | Sync tests |