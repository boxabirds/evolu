# MLS TypeScript POC Implementation Plan (Using Bun)

## Project Overview
Build a proof-of-concept implementation of MLS in TypeScript using Bun that demonstrates:
1. Tree-based key distribution scaling to 1000 members
2. O(log N) operations for add/remove members
3. Shared branch access for encrypted data
4. Performance comparison with O(N) approach

## Project Structure
```
pocs/mls/
├── concepts.md (existing)
├── plan.md (this file)
├── package.json
├── tsconfig.json
├── bunfig.toml
├── src/
│   ├── index.ts
│   ├── tree/
│   │   ├── RatchetTree.ts
│   │   ├── TreeNode.ts
│   │   └── TreeMath.ts
│   ├── crypto/
│   │   ├── KeyDerivation.ts
│   │   ├── Encryption.ts
│   │   └── PathSecrets.ts
│   ├── protocol/
│   │   ├── Member.ts
│   │   ├── Group.ts
│   │   └── Messages.ts
│   ├── demo/
│   │   ├── ScalingDemo.ts
│   │   └── SharedAccessDemo.ts
│   └── benchmarks/
│       ├── AddMemberBenchmark.ts
│       ├── RemoveMemberBenchmark.ts
│       └── ComparisonBenchmark.ts
├── tests/
│   ├── tree.test.ts
│   ├── crypto.test.ts
│   └── protocol.test.ts
└── README.md
```

## Bun-Specific Setup

### bunfig.toml
```toml
[install]
auto = "auto"
frozenLockfile = false

[test]
coverage = true
coverageThreshold = 80
```

### package.json
```json
{
  "name": "@evolu/mls-poc",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.ts",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "bench": "bun run src/benchmarks/index.ts",
    "demo:scaling": "bun run src/demo/ScalingDemo.ts",
    "demo:shared": "bun run src/demo/SharedAccessDemo.ts",
    "build": "bun build src/index.ts --outdir=dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@noble/hashes": "^1.3.0",
    "@noble/curves": "^1.0.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
```

## Implementation Phases

### Phase 1: Core Tree Structure

**RatchetTree.ts**
- Binary tree structure with member leaves
- Support for up to 1024 members (2^10)
- Efficient path computation
- Tree balancing for optimal depth

**TreeNode.ts**
- Node types: Leaf (member) and Parent (intermediate)
- Node secrets and public keys
- Parent hash computation

**TreeMath.ts**
- Helper functions for tree navigation
- Parent/sibling/copath calculations
- Level and index conversions

### Phase 2: Cryptographic Layer

**KeyDerivation.ts**
```typescript
// Using Bun's built-in crypto
import { crypto } from "bun";

export async function deriveKey(
  secret: Uint8Array, 
  info: string
): Promise<CryptoKey> {
  // Use Bun's crypto APIs
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HKDF", hash: "SHA-256" },
    false,
    ["deriveKey"]
  );
  
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32),
      info: new TextEncoder().encode(info),
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
```

**Encryption.ts**
- AEAD encryption for application messages
- Key encapsulation for welcome messages
- Leverage Bun's crypto performance

**PathSecrets.ts**
- Compute path secrets for member updates
- Derive node keys from path secrets
- Handle copath updates

### Phase 3: Protocol Implementation

**Member.ts**
```typescript
interface Member {
  id: string;
  leafIndex: number;
  publicKey: CryptoKey;
  privateKey?: CryptoKey; // Only for self
  pathSecrets: PathSecret[];
}
```

**Group.ts**
```typescript
class MLSGroup {
  tree: RatchetTree;
  epoch: number;
  members: Map<number, Member>;
  
  addMember(member: Member): AddResult;
  removeMember(leafIndex: number): RemoveResult;
  deriveGroupKey(): CryptoKey;
}
```

**Messages.ts**
- Welcome messages for new members
- Commit messages for updates
- Application message encryption

### Phase 4: Demonstrations

**ScalingDemo.ts**
```typescript
// Bun-optimized performance demo
import { MLSGroup } from "../protocol/Group";

console.time("Add 1000 members");

const group = new MLSGroup();
const results: BenchmarkResult[] = [];

for (let i = 0; i < 1000; i++) {
  const start = Bun.nanoseconds();
  const result = group.addMember(createMember(i));
  const end = Bun.nanoseconds();
  
  results.push({
    memberCount: i + 1,
    operationTime: (end - start) / 1_000_000, // Convert to ms
    messagesGenerated: result.messages.length,
  });
  
  if (i % 100 === 0) {
    console.log(`Added ${i + 1} members...`);
  }
}

console.timeEnd("Add 1000 members");

// Output results as CSV for graphing
await Bun.write("scaling-results.csv", 
  results.map(r => `${r.memberCount},${r.operationTime},${r.messagesGenerated}`).join("\n")
);
```

**SharedAccessDemo.ts**
- Create groups of members on same branch
- Demonstrate shared secret derivation
- Show how branch members can decrypt same data
- Visualize access patterns

### Phase 5: Benchmarks Using Bun's Built-in Bench

**benchmarks/index.ts**
```typescript
import { bench, run } from "bun:test";
import { MLSGroup } from "../protocol/Group";
import { TraditionalGroup } from "./TraditionalGroup";

// MLS approach
bench("MLS: Add member to 100-member group", () => {
  const group = createMLSGroup(100);
  group.addMember(createMember(100));
});

bench("MLS: Add member to 1000-member group", () => {
  const group = createMLSGroup(1000);
  group.addMember(createMember(1000));
});

// Traditional O(N) approach
bench("Traditional: Add member to 100-member group", () => {
  const group = createTraditionalGroup(100);
  group.addMember(createMember(100));
});

bench("Traditional: Add member to 1000-member group", () => {
  const group = createTraditionalGroup(1000);
  group.addMember(createMember(1000));
});

await run();
```

## Key Technical Components

### Tree Operations with Bun Optimizations
```typescript
// Use Bun's fast array operations
function getPath(leafIndex: number): TreeNode[] {
  const path: TreeNode[] = [];
  let current = leafIndex;
  while (current > 0) {
    current = parent(current);
    path.push(tree.nodes[current]);
  }
  return path;
}

// Leverage Bun's performance for batch operations
async function updateMultiplePaths(leafIndices: number[]): Promise<PathUpdate[]> {
  // Bun handles parallel promises efficiently
  return Promise.all(
    leafIndices.map(index => updatePath(index))
  );
}
```

### Shared Branch Access
```typescript
// Members on same branch share intermediate secrets
function demonstrateSharedAccess() {
  // Members 0-3 share a subtree
  const subtreeRoot = tree.getNode(parent(parent(0)));
  const sharedSecret = subtreeRoot.deriveSecret();
  
  // All members under this node can derive the same key
  const members = [0, 1, 2, 3];
  for (const leafIndex of members) {
    const member = group.getMember(leafIndex);
    const derivedKey = member.deriveSubtreeKey(subtreeRoot);
    // All derivedKeys are identical
  }
}
```

### Tree Operations
```typescript
// Efficient path computation
function getPath(leafIndex: number): TreeNode[] {
  const path: TreeNode[] = [];
  let current = leafIndex;
  while (current > 0) {
    current = parent(current);
    path.push(tree.nodes[current]);
  }
  return path;
}

// Update path secrets on member change
function updatePath(leafIndex: number): PathUpdate {
  const path = getPath(leafIndex);
  const newSecrets = generatePathSecrets(path.length);
  
  // Only O(log N) updates needed
  for (let i = 0; i < path.length; i++) {
    path[i].secret = newSecrets[i];
  }
  
  return { path, affectedMembers: getAffectedMembers(path) };
}
```

## Testing with Bun's Test Runner

**tests/tree.test.ts**
```typescript
import { test, expect } from "bun:test";
import { RatchetTree } from "../src/tree/RatchetTree";

test("tree operations", () => {
  const tree = new RatchetTree();
  
  // Add members
  for (let i = 0; i < 10; i++) {
    tree.addLeaf(createMember(i));
  }
  
  expect(tree.size).toBe(10);
  expect(tree.depth).toBe(4); // ceil(log2(10))
});

test("path computation", () => {
  const tree = new RatchetTree();
  tree.initialize(8); // 8 members
  
  const path = tree.getPath(5);
  expect(path).toHaveLength(3); // log2(8) = 3
});
```

## Performance Metrics

```typescript
interface BenchmarkResult {
  operation: 'add' | 'remove';
  groupSize: number;
  operationTime: number;
  messagesGenerated: number;
  keysDistributed: number;
}
```

## Bun-Specific Advantages

1. **Performance**: Bun's native performance for crypto operations
2. **Built-in Testing**: No need for external test runners
3. **Fast Package Installation**: Quicker dependency resolution
4. **TypeScript Support**: Native TS execution without compilation
5. **Benchmarking**: Built-in bench tool for performance testing

## Running the POC

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run scaling demo
bun run demo:scaling

# Run benchmarks
bun run bench

# Build for production
bun build src/index.ts --target=bun --outdir=dist
```

## Success Criteria

1. Successfully manage groups up to 1000 members
2. Demonstrate O(log N) scaling for operations
3. Show < 100ms operation time for 1000-member groups (leveraging Bun's speed)
4. Prove shared branch access works correctly
5. Clear performance advantage over O(N) approach
6. All tests passing with >80% coverage

## Documentation

The README.md will include:
- Quick start guide
- Architecture overview
- Performance results
- Visual tree diagrams
- API reference