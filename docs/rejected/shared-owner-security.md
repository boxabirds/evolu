# SharedOwner Security Analysis

## Executive Summary

This document analyzes the security implications of implementing SharedOwner functionality in Evolu. The implementation enables multi-owner data partitioning while maintaining Evolu's cryptographic guarantees and zero-knowledge architecture.

## Core Security Model

### Data Isolation Model

```mermaid
graph TB
    subgraph "SQLite Database"
        subgraph "AppOwner Data Space"
            AO[evolu_owner<br/>mnemonic, keys]
            ESO[evolu_shared_owner<br/>encrypted SharedOwner credentials]
            PersonalData[Personal user tables]
        end
        
        subgraph "SharedOwner A Data Space"
            TeamAData[Shared data tables<br/>Only accessible with SharedOwner A keys]
        end
        
        subgraph "SharedOwner B Data Space"
            TeamBData[Shared data tables<br/>Only accessible with SharedOwner B keys]
        end
        
        subgraph "System Tables"
            History[evolu_history<br/>Partitioned by ownerId]
        end
    end
    
    AO -->|"ownerId=AppOwner"| History
    TeamAData -->|"ownerId=SharedOwnerA"| History
    TeamBData -->|"ownerId=SharedOwnerB"| History
    
    style AO fill:#f99,stroke:#333,stroke-width:2px
    style ESO fill:#f9f,stroke:#333,stroke-width:2px
    style History fill:#ddd,stroke:#333,stroke-width:2px
```

**Key Security Properties:**
- Each ownerId creates a cryptographic boundary
- Data in evolu_history is partitioned by ownerId
- SharedOwner credentials stored encrypted in AppOwner space
- No cross-owner data access possible without keys

## Key Management Architecture

### Key Derivation and Storage

```mermaid
flowchart TD
    subgraph "AppOwner"
        AM[AppOwner Mnemonic<br/>User memorizes]
        AK[AppOwner Keys<br/>Derived via SLIP-21]
        AM -->|Deterministic| AK
    end
    
    subgraph "SharedOwner"
        SM[SharedOwner Mnemonic<br/>Generated fresh]
        SEK[Encryption Key<br/>Derived via SLIP-21]
        SWK[Write Key<br/>Random bytes]
        SM -->|Deterministic| SEK
        SM -.->|NOT derived| SWK
    end
    
    subgraph "Storage"
        DB[(evolu_shared_owner table)]
        AK -->|Encrypts| DB
        DB -->|Stores| SM
        DB -->|Stores| SWK
    end
    
    style AM fill:#f99,stroke:#333,stroke-width:2px
    style SM fill:#99f,stroke:#333,stroke-width:2px
    style SWK fill:#ff9,stroke:#333,stroke-width:2px
```

**Security Design Decisions:**
1. **AppOwner mnemonic**: Never stored, user must memorize
2. **SharedOwner mnemonic**: Stored encrypted by AppOwner
3. **SharedOwner writeKey**: Random (not derived) for revocability

### Access Control Levels

```mermaid
stateDiagram-v2
    [*] --> NoAccess
    
    state NoAccess {
        note: No mnemonic = No access
    }
    
    state "Read-Only Access" as ReadOnly {
        note: Has SharedOwner mnemonic only
    }
    
    state "Read-Write Access" as ReadWrite {
        note: Has mnemonic + writeKey
    }
    
    NoAccess --> ReadOnly: Receive mnemonic
    ReadOnly --> ReadWrite: Receive writeKey
    ReadWrite --> ReadOnly: WriteKey revoked
```

## Threat Analysis

### Threat 1: Database File Access

**Scenario**: Attacker gains access to SQLite database file

```mermaid
sequenceDiagram
    participant Attacker
    participant SQLite as SQLite File
    participant Crypto
    
    Attacker->>SQLite: Read evolu_history
    SQLite-->>Attacker: Encrypted blobs + ownerIds
    
    Note over Attacker: Has: Encrypted data<br/>Missing: Mnemonics
    
    Attacker->>Crypto: Attempt decrypt without keys
    Crypto-->>Attacker: ❌ Decryption fails
    
    Attacker->>SQLite: Read evolu_owner
    SQLite-->>Attacker: Only AppOwner info<br/>(no SharedOwner mnemonics)
    
    Note over Attacker: Cannot access any data<br/>without mnemonics
```

**Mitigation**: All data encrypted at rest, keys never stored in database

### Threat 2: Malicious Team Member

**Scenario**: Team member attempts unauthorized access

```mermaid
sequenceDiagram
    participant BadActor as Malicious User
    participant Evolu
    participant DB as Database
    
    Note over BadActor: Has: SharedOwner A credentials<br/>Wants: SharedOwner B data
    
    BadActor->>Evolu: Query for SharedOwner B data
    Evolu->>Evolu: Derive ownerId from SharedOwner A
    Evolu->>DB: SELECT WHERE ownerId = SharedOwnerA_ID
    DB-->>Evolu: Only SharedOwner A data
    Evolu-->>BadActor: No SharedOwner B data returned
    
    BadActor->>Evolu: Attempt direct SQL injection
    Note over Evolu: Prepared statements<br/>prevent injection
    Evolu-->>BadActor: ❌ Query fails
```

**Mitigation**: Cryptographic isolation by ownerId, prepared statements

### Threat 3: WriteKey Compromise

**Scenario**: Need to revoke write access

```mermaid
flowchart LR
    subgraph "Before Revocation"
        U1[User 1<br/>mnemonic + writeKey1]
        U2[User 2<br/>mnemonic + writeKey1]
        U3[Compromised User<br/>mnemonic + writeKey1]
    end
    
    subgraph "Revocation Process"
        Admin[Admin] -->|rotateWriteKey| NewKey[writeKey2]
    end
    
    subgraph "After Revocation"
        U1N[User 1<br/>mnemonic + writeKey2]
        U2N[User 2<br/>mnemonic + writeKey2]
        U3N[Compromised User<br/>mnemonic + writeKey1]
    end
    
    U1 --> U1N
    U2 --> U2N
    U3 --> U3N
    
    style U3 fill:#f99,stroke:#333,stroke-width:2px
    style U3N fill:#faa,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
```

**Result**: Compromised user retains read access but loses write access

### Threat 4: Relay/Network Attacks

**Scenario**: Network infrastructure compromise

```mermaid
graph TD
    subgraph "Attack Surface"
        Network[Network Attacker]
        Relay[Compromised Relay]
    end
    
    subgraph "What Attacker Sees"
        EB[Encrypted Blobs]
        OID[OwnerIds<br/>Opaque identifiers]
        TS[Timestamps]
        Meta[Metadata<br/>Size, frequency]
    end
    
    subgraph "What Attacker Cannot Do"
        NoDec[❌ Decrypt data<br/>No encryption keys]
        NoLink[❌ Link owners to users<br/>IDs are opaque]
        NoForge[❌ Forge updates<br/>No write keys]
    end
    
    Network --> EB
    Relay --> OID
    Relay --> TS
    Relay --> Meta
    
    EB -.-> NoDec
    OID -.-> NoLink
    TS -.-> NoForge
```

**Impact**: Limited to metadata analysis and denial of service

## Cryptographic Boundaries

### Encryption Scope

```mermaid
flowchart TB
    subgraph "Clear Text"
        Schema[Table schemas]
        Indexes[Index definitions]
    end
    
    subgraph "Encrypted by AppOwner"
        Teams[teams table<br/>SharedOwner credentials]
        Personal[Personal data tables]
    end
    
    subgraph "Encrypted by SharedOwner A"
        TeamA[Team A tables]
        HistoryA[evolu_history<br/>ownerId=SharedOwnerA]
    end
    
    subgraph "Encrypted by SharedOwner B"
        TeamB[Team B tables]
        HistoryB[evolu_history<br/>ownerId=SharedOwnerB]
    end
    
    style Schema fill:#ddd,stroke:#333,stroke-width:2px
    style Teams fill:#f99,stroke:#333,stroke-width:2px
    style TeamA fill:#99f,stroke:#333,stroke-width:2px
    style TeamB fill:#9f9,stroke:#333,stroke-width:2px
```

### CRDT Security Properties

```mermaid
sequenceDiagram
    participant User1 as User 1
    participant User2 as User 2
    participant CRDT as CRDT Layer
    participant Sync as Sync Protocol
    
    User1->>CRDT: Update with SharedOwner
    CRDT->>CRDT: Generate timestamp
    CRDT->>Sync: Encrypt with SharedOwner.encryptionKey
    
    Sync-->>User2: Encrypted update
    User2->>CRDT: Decrypt with SharedOwner.encryptionKey
    CRDT->>CRDT: Validate timestamp
    CRDT->>CRDT: Merge by Last-Write-Wins
    
    Note over CRDT: Timestamps prevent<br/>replay attacks
```

## Implementation Security Checklist

### Required Security Measures

- [x] SharedOwner credentials encrypted in user space
- [x] OwnerId derivation uses cryptographic functions
- [x] WriteKey is random, not derived
- [x] All queries use prepared statements
- [x] Owner context validated on every mutation
- [x] No SharedOwner data in evolu_owner table

### Security Invariants

1. **Mnemonic Protection**
   ```typescript
   // INVARIANT: Never log or transmit mnemonics
   assert(typeof sharedOwner.mnemonic === "string");
   // ❌ console.log(sharedOwner.mnemonic);
   // ❌ fetch("/api", { body: JSON.stringify(sharedOwner) });
   ```

2. **Owner Isolation**
   ```typescript
   // INVARIANT: Data filtered by ownerId
   const ownerId = deriveOwnerIdFromOwner(owner);
   sql`SELECT * FROM evolu_history WHERE ownerId = ${ownerId}`;
   ```

3. **Encryption Boundary**
   ```typescript
   // INVARIANT: All user data encrypted before storage
   const encrypted = encrypt(data, owner.encryptionKey);
   sql`INSERT INTO evolu_history (..., value) VALUES (..., ${encrypted})`;
   ```

## Privacy Considerations

### Metadata Leakage

What the relay/network observer can infer:
- Number of owners syncing
- Frequency of updates per owner
- Size of updates
- Timing patterns

What they cannot infer:
- Identity of owners
- Relationship between owners
- Content of data
- Type of application

### GDPR Compliance

```mermaid
flowchart LR
    subgraph "User Rights"
        Access[Right to Access]
        Rectify[Right to Rectification]
        Erase[Right to Erasure]
        Port[Right to Portability]
    end
    
    subgraph "Implementation"
        Mnemonic[User controls mnemonic]
        CRDT[CRDT allows updates]
        Local[Local-first architecture]
        Export[Export function]
    end
    
    Access --> Mnemonic
    Rectify --> CRDT
    Erase --> Local
    Port --> Export
```

## Security Recommendations

### For Evolu Library Users

1. **Secure Credential Storage**
   ```typescript
   // SharedOwner credentials are automatically stored in evolu_shared_owner table
   const sharedOwner = createSharedOwner(deps);
   // Evolu handles storage internally - encrypted by AppOwner
   ```

2. **Access Control Patterns**
   ```typescript
   // Read-only sharing
   const readOnlyAccess = {
     mnemonic: sharedOwner.mnemonic
     // Omit writeKey
   };
   
   // Full access sharing  
   const fullAccess = sharedOwner; // Include writeKey
   ```

3. **Key Rotation**
   ```typescript
   // Rotate compromised writeKey
   const newWriteKey = createWriteKey(deps)();
   const rotated = rotateWriteKey(sharedOwner, newWriteKey);
   // Distribute new writeKey to authorized users
   ```

### For End Users

1. **Mnemonic Hierarchy**
   - AppOwner mnemonic = Master password (memorize, never share)
   - SharedOwner mnemonic = Team invitation (share via secure channel)
   - WriteKey = Edit permission (easily revocable)

2. **Secure Sharing**
   - Use end-to-end encrypted channels for sharing
   - Verify recipient identity before sharing
   - Rotate writeKeys periodically

## Conclusion

The SharedOwner implementation maintains Evolu's security guarantees:
- ✅ Zero-knowledge architecture preserved
- ✅ Cryptographic data isolation 
- ✅ No new attack vectors introduced
- ✅ Granular access control added
- ✅ Key rotation capability included

The design ensures that multi-owner collaboration does not compromise the security properties of the single-owner model.