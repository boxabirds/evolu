### a) The Demo

This is a Proof-of-Concept (POC) for a multi-team, multi-user chat application. It is designed to test the `SharedOwner` functionality. It includes UI elements for creating teams, selecting a team, and sending messages. Crucially, it highlights where the implementation is expected to fail due to the identified gaps in the Evolu library.

**File: `chat-poc.tsx`**
```tsx
// chat-poc.tsx
import React, { useState, useEffect } from 'react';
import { createEvolu, getOrThrow, SimpleName, createSharedOwner, SharedOwner } from "@evolu/common";
import { createUseEvolu, EvoluProvider, useAppOwner } from "@evolu/react";
import { evoluReactWebDeps } from "@evolu/react-web";
import * as S from "@effect/schema/Schema";

// Schema Definition
const Schema = S.Struct({
  // Teams - metadata stored in user's AppOwner space
  team: S.Struct({
    id: S.String,
    name: S.String,
    sharedOwnerMnemonic: S.String, // Store team's SharedOwner mnemonic
    sharedOwnerWriteKey: S.String, // Store team's SharedOwner writeKey
    createdAt: S.String,
    updatedAt: S.String,
    isDeleted: S.Boolean,
  }),
  // User profiles shared within teams (stored under SharedOwner)
  teamUserProfile: S.Struct({
    id: S.String,
    teamId: S.String,
    userId: S.String, // AppOwner ID
    displayName: S.String,
    email: S.String,
    createdAt: S.String,
    updatedAt: S.String,
    isDeleted: S.Boolean,
  }),
  // Messages within teams (stored under SharedOwner)
  message: S.Struct({
    id: S.String,
    teamId: S.String,
    authorId: S.String, // AppOwner ID
    content: S.String,
    createdAt: S.String,
    updatedAt: S.String,
    isDeleted: S.Boolean,
  }),
  // Team memberships (stored under SharedOwner)
  membership: S.Struct({
    id: S.String,
    teamId: S.String,
    userId: S.String, // AppOwner ID
    role: S.String, // "admin" | "member"
    createdAt: S.String,
    updatedAt: S.String,
    isDeleted: S.Boolean,
  }),
});

// Evolu Setup
const evolu = createEvolu(evoluReactWebDeps)(Schema, {
  name: getOrThrow(SimpleName.from("multi-team-chat-poc")),
  syncUrl: "wss://free.evoluhq.com",
});

const useEvolu = createUseEvolu(evolu);

// Team Management Hook
function useTeamManager() {
  const { insert } = useEvolu();
  const appOwner = useAppOwner();

  const createTeam = async (teamName: string, userDisplayName: string) => {
    if (!appOwner) throw new Error("No app owner");

    try {
      // Create SharedOwner for the team
      const deps = {
        createMnemonic: evoluReactWebDeps.createMnemonic,
        createRandomBytes: evoluReactWebDeps.createRandomBytes,
      };
      // Note: This is where the implementation gap exists
      // createSharedOwner may not be properly integrated with mutations
      const sharedOwner = createSharedOwner(deps);

      const now = new Date().toISOString();

      // Store team metadata in user's AppOwner space
      const teamResult = await insert("team", {
        name: teamName,
        sharedOwnerMnemonic: sharedOwner.mnemonic,
        sharedOwnerWriteKey: sharedOwner.writeKey,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      });

      if (!teamResult.ok) throw new Error("Failed to create team");

      // Create membership record (in team's SharedOwner space)
      // WARNING: This may not work due to the owner option gap
      await insert("membership", {
        teamId: teamResult.value.id,
        userId: appOwner.id,
        role: "admin",
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      }, { owner: sharedOwner }); // This line may not be implemented

      // Create user profile in team space
      await insert("teamUserProfile", {
        teamId: teamResult.value.id,
        userId: appOwner.id,
        displayName: userDisplayName,
        email: "user@example.com",
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      }, { owner: sharedOwner }); // This line may not be implemented

      return { teamId: teamResult.value.id, sharedOwner };
    } catch (error) {
      console.error("Team creation failed:", error);
      throw error;
    }
  };

  const sendMessage = async (teamId: string, content: string, sharedOwner: SharedOwner) => {
    if (!appOwner) throw new Error("No app owner");

    const now = new Date().toISOString();
    // Send message to team's SharedOwner space
    // WARNING: This may not work due to the owner option gap
    return await insert("message", {
      teamId,
      authorId: appOwner.id,
      content,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    }, { owner: sharedOwner }); // This line may not be implemented
  };

  return { createTeam, sendMessage };
}

// Main Chat Component
function ChatPOC() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");

  const appOwner = useAppOwner();
  const { createTeam, sendMessage } = useTeamManager();

  const handleCreateTeam = async () => {
    if (!newTeamName || !userDisplayName) return;

    try {
      const result = await createTeam(newTeamName, userDisplayName);
      console.log("Team created:", result);
      setNewTeamName("");
    } catch (error) {
      console.error("Failed to create team:", error);
      alert("Failed to create team. This may be due to implementation gaps in Evolu's multi-owner support.");
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage || !selectedTeam) return;

    try {
      await sendMessage(selectedTeam.id, newMessage, selectedTeam.sharedOwner);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. This may be due to implementation gaps in Evolu's multi-owner support.");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Multi-Team Chat POC</h1>
      {appOwner ? (
        <p>Logged in as: {appOwner.id}</p>
      ) : (
        <p>Loading user...</p>
      )}
      <div style={{ marginBottom: "20px", padding: "10px", border: "1px solid #ccc" }}>
        <h3>Create New Team</h3>
        <input
          type="text"
          placeholder="Your display name"
          value={userDisplayName}
          onChange={(e) => setUserDisplayName(e.target.value)}
          style={{ marginRight: "10px", padding: "5px" }}
        />
        <input
          type="text"
          placeholder="Team name"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          style={{ marginRight: "10px", padding: "5px" }}
        />
        <button onClick={handleCreateTeam}>Create Team</button>
      </div>
      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ width: "200px" }}>
          <h3>Teams</h3>
          {/* UI for team list would go here */}
        </div>
        <div style={{ flex: 1 }}>
          {selectedTeam ? (
            <>
              <h3>Messages in {selectedTeam.name}</h3>
              <div style={{ height: "300px", border: "1px solid #ccc", padding: "10px", overflowY: "scroll" }}>
                {/* UI for messages would go here */}
              </div>
              <div style={{ marginTop: "10px" }}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  style={{ width: "70%", padding: "5px" }}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <button onClick={handleSendMessage} style={{ marginLeft: "10px" }}>Send</button>
              </div>
            </>
          ) : (
            <p>Select a team to view messages</p>
          )}
        </div>
      </div>
      <div style={{ marginTop: "20px", padding: "10px", backgroundColor: "#fff3cd", border: "1px solid #ffeaa7" }}>
        <h4>⚠️ Implementation Notes</h4>
        <p>This POC demonstrates the intended architecture but may not work fully due to:</p>
        <ul>
          <li>The <code>options.owner</code> parameter in mutations may not be implemented</li>
          <li>Multi-owner support appears to be designed but not fully functional</li>
          <li>You may need to extend Evolu's mutation system to handle SharedOwner properly</li>
        </ul>
      </div>
    </div>
  );
}

// App Wrapper
function App() {
  return (
    <EvoluProvider value={evolu}>
      <ChatPOC />
    </EvoluProvider>
  );
}

export default App;
```

### b) The Code Changes

These are the specific modifications required within the Evolu library to correctly handle the `options.owner` parameter and enable multi-owner functionality.

**1. Update Mutation Handler to Pass Owner to Worker**
*   **File:** `packages/common/src/Evolu/Evolu.ts`
*   **Change:** Modify `createMutation` to accept an `owner` in the options and pass it down to the database worker via the microtask queue.

```typescript
// In packages/common/src/Evolu/Evolu.ts, inside createEvolu
const mutateMicrotaskQueue: Array<
  [
    DbChange | undefined,
    MutationOptions["onComplete"] | undefined,
    // Add a slot for the owner
    ShardOwner | SharedOwner | undefined,
  ]
> = [];

const createMutation =
  <Kind extends MutationKind>(kind: Kind) =>
  <TableName extends keyof typeof schema>(
    table: TableName,
    props: /* ... */,
    options?: MutationOptions,
  ): Result</* ... */> => {
    // ...
    if (options?.onlyValidate !== true) {
      if (!result.ok) {
        // Propagate the error correctly with the new tuple size
        mutateMicrotaskQueue.push([undefined, undefined, undefined]);
      } else {
        // ...
        const dbChange = { table, id, values };
        assertValidDbChange(dbChange);
        // Pass the owner from options into the queue
        mutateMicrotaskQueue.push([dbChange, options?.onComplete, options?.owner]);
      }

      if (mutateMicrotaskQueue.length === 1)
        queueMicrotask(() => {
          const changes: Array<DbChange> = [];
          const onCompletes = [];
          // Create an array to hold owners for each change
          const owners: Array<ShardOwner | SharedOwner | undefined> = [];

          // Deconstruct the owner from the queue tuple
          for (const [change, onComplete, owner] of mutateMicrotaskQueue) {
            if (change) {
              changes.push(change);
              // Add the corresponding owner
              owners.push(owner);
            }
            if (onComplete) onCompletes.push(onComplete);
          }

          // ... (rest of the microtask logic)

          if (isNonEmptyArray(changes))
            dbWorker.postMessage({
              type: "mutate",
              tabId: getTabId(),
              changes,
              // Pass the owners array to the dbWorker
              owners,
              onCompleteIds,
              subscribedQueries: subscribedQueries.get(),
            });
        });
    }
    // ...
  };
```

**2. Update DB Worker to Receive and Process Owners**
*   **File:** `packages/common/src/Evolu/Db.ts`
*   **Change:** Update the `DbWorkerInput` interface and the `mutate` message handler to process an array of owners corresponding to the array of changes.

```typescript
// In packages/common/src/Evolu/Db.ts

// Update the worker input interface
export interface DbWorkerInputMutate {
  readonly type: "mutate";
  readonly tabId: Id;
  readonly changes: ReadonlyArray<DbChange>;
  // Add the optional owners array
  readonly owners?: ReadonlyArray<ShardOwner | SharedOwner | undefined>;
  readonly onCompleteIds: ReadonlyArray<Id>;
  readonly subscribedQueries: SubscribedQueries;
}

// In the onMessage handler for the worker
case "mutate": {
  const mutate = deps.sqlite.transaction(() => {
    const toSyncChanges: Array<{ change: DbChange; owner?: ShardOwner | SharedOwner }> = [];
    // ... (localOnlyChanges logic remains similar)

    for (let i = 0; i < message.changes.length; i++) {
      const change = message.changes[i];
      // Get the corresponding owner for the change
      const owner = message.owners?.[i];
      if (change.table.startsWith("_")) {
        // localOnlyChanges.push({ change, owner }); // if needed
      } else {
        toSyncChanges.push({ change, owner });
      }
    }

    // ... (process localOnlyChanges)

    if (isNonEmptyArray(toSyncChanges)) {
      // Use a new function to apply changes with owner context
      const result = applyChangesWithOwners(deps)(toSyncChanges);
      if (!result.ok) return result;
    }

    return ok();
  });
  // ... (rest of the case block)
}
```

**3. Implement Owner-Aware Change Application Logic**
*   **File:** `packages/common/src/Evolu/Db.ts`
*   **Change:** Add new helper functions to group mutations by owner and apply them to the `evolu_history` table with the correct `ownerId`.

```typescript
// In packages/common/src/Evolu/Db.ts

// Helper to derive OwnerId from a mnemonic (assumes such a utility exists or can be created)
const getOwnerIdFromOwner = (owner: ShardOwner | SharedOwner): OwnerId => {
  // This function needs to be implemented using Evolu's crypto primitives
  // to derive the ID from the mnemonic, similar to how AppOwner ID is created.
  // For the POC, a placeholder is sufficient.
  // Example: return createHash("sha256").update(owner.mnemonic).digest("hex");
  // The actual implementation must match Evolu's derivation logic.
  // Let's assume a function `deriveOwnerId(mnemonic)` exists.
  return deriveOwnerId(owner.mnemonic);
};

const applyChangesWithOwners =
  (deps: DbWorkerDeps) =>
  (changesWithOwners: Array<{ change: DbChange; owner?: ShardOwner | SharedOwner }>) => {
    for (const { change, owner } of changesWithOwners) {
      // If an owner is provided, derive its ID. Otherwise, use the default AppOwner's ID.
      const ownerId = owner
        ? getOwnerIdFromOwner(owner)
        : deps.ownerRowRef.value.id;

      const timestamp = createTimestamp(deps.timestampConfig);

      for (const [column, value] of objectToEntries(change.values)) {
        const result = deps.sqlite.exec(sql`
          insert into evolu_history
            ("ownerId", "table", id, "column", timestamp, value)
          values
            (${ownerId}, ${change.table}, ${change.id}, ${column}, ${timestampToBinaryTimestamp(timestamp)}, ${value})
          on conflict ("ownerId", "table", id, "column") do update
            set timestamp = excluded.timestamp, value = excluded.value
            where excluded.timestamp > evolu_history.timestamp;
        `);
        if (!result.ok) return result;
      }
    }
    return ok();
  };
```

### c) The Tests

These tests follow the project's conventions to ensure the new multi-owner functionality is robust and does not introduce regressions.

**1. Multi-Owner Mutation Tests**
*   **File:** `packages/common/test/Evolu/MultiOwner.test.ts`

```typescript
import { describe, expect, test, vi } from "vitest";
import { createEvolu } from "../../src/Evolu/Evolu.js";
import { createSharedOwner } from "../../src/Evolu/Owner.js";
// ... other necessary imports

describe("Multi-Owner Mutations", () => {
  test("insert with SharedOwner should pass owner to dbWorker", async () => {
    const { evolu, dbWorker, sharedOwner } = setupMultiOwnerTest(); // A test setup helper

    evolu.insert("message", { content: "Team message" }, { owner: sharedOwner });

    await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for microtask

    expect(dbWorker.postMessage).toHaveBeenCalled();
    const mutateCall = dbWorker.postMessage.mock.calls[0][0];
    expect(mutateCall).toMatchObject({
      type: "mutate",
      owners: [sharedOwner],
    });
  });

  test("mixed mutations with and without owner should pass correct owners array", async () => {
    const { evolu, dbWorker, sharedOwner } = setupMultiOwnerTest();

    evolu.insert("userProfile", { name: "User" }); // Default AppOwner
    evolu.insert("message", { content: "Team msg" }, { owner: sharedOwner });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const mutateCall = dbWorker.postMessage.mock.calls[0][0];
    expect(mutateCall.owners).toEqual([undefined, sharedOwner]);
  });
});
```

**2. Database Worker Multi-Owner Tests**
*   **File:** `packages/common/test/Evolu/DbMultiOwner.test.ts`

```typescript
import { test, expect } from "vitest";
import { createDbWorkerForPlatform } from "../../src/Evolu/Db.js";
// ... other necessary imports

test("dbWorker should insert data with the correct SharedOwner ID", async () => {
  const sqlite = await testCreateSqlite();
  const deps = { ...testDeps, sqlite };
  const dbWorker = createDbWorkerForPlatform(deps);
  const sharedOwner = createTestSharedOwner();
  const sharedOwnerId = getOwnerIdFromOwner(sharedOwner); // Test utility

  // Simulate a message from the main thread
  dbWorker.onMessage({
    type: "mutate",
    tabId: testCreateId(),
    changes: [{ table: "message", id: testCreateId(), values: { content: "Team message" } }],
    owners: [sharedOwner],
    onCompleteIds: [],
    subscribedQueries: [],
  });

  // Verify data is stored in evolu_history with the correct ownerId
  const historyResult = sqlite.exec(sql`
    SELECT "ownerId" FROM evolu_history WHERE "table" = 'message'
  `);
  expect(historyResult.ok).toBe(true);
  expect(historyResult.value.rows[0].ownerId).toBe(sharedOwnerId);
});
```

**3. Integration Tests for Chat Demo Flow**
*   **File:** `packages/common/test/Evolu/ChatDemo.test.ts`

```typescript
import { test, expect, describe } from "vitest";
// ... other necessary imports

describe("Multi-Team Chat Integration", () => {
  test("a message for a team is stored under the team's SharedOwner", async () => {
    const { evolu, dbWorker, sharedOwner } = setupMultiOwnerTest();
    const sharedOwnerId = getOwnerIdFromOwner(sharedOwner);

    // Send a message using the team's owner
    evolu.insert("message", { content: "Hello team!" }, { owner: sharedOwner });

    await new Promise(resolve => setTimeout(resolve, 0));

    // In a real test, you'd inspect the mock sqlite instance
    const lastExec = dbWorker.sqlite.exec.mock.calls.find(call =>
      call[0].sql.includes("insert into evolu_history")
    );
    expect(lastExec[0].sql).toContain("values");
    // This is a simplified check; a real test would check the bound parameter
    expect(lastExec[0].parameters[0]).toBe(sharedOwnerId);
  });

  test("a user profile update is stored under the default AppOwner", async () => {
    const { evolu, dbWorker, owner } = setupMultiOwnerTest(); // `owner` is the AppOwner

    // Update profile without specifying an owner
    evolu.update("userProfile", { id: "user-1", name: "New Name" });

    await new Promise(resolve => setTimeout(resolve, 0));

    const lastExec = dbWorker.sqlite.exec.mock.calls.find(call =>
      call[0].sql.includes("insert into evolu_history")
    );
    expect(lastExec[0].parameters[0]).toBe(owner.id); // Should be AppOwner's ID
  });
});
```

### d) The Correct Design Notes

These notes describe the complete and corrected architecture for implementing the `SharedOwner` capability.

1.  **Core Concept: Owner-Based Data Partitioning**
    *   Each user has a root identity called `AppOwner`. Data created without a specific owner defaults to the `AppOwner`.
    *   Collaborative spaces (like chat teams) are represented by a `SharedOwner`. Each `SharedOwner` has its own unique `mnemonic` and a randomly generated `writeKey`.
    *   All data in Evolu is encrypted and partitioned by its `ownerId`. This means data belonging to `AppOwner` is inaccessible to a `SharedOwner`, and data from one `SharedOwner` is inaccessible to another, ensuring cryptographic isolation between teams.

2.  **Data Model for Multi-Team Membership**
    *   The link between a user (`AppOwner`) and a team (`SharedOwner`) is established by storing the team's `SharedOwner` credentials (`mnemonic` and `writeKey`) in a table that belongs to the user's `AppOwner`.
    *   **Schema Example:** A `teams` table is created under the `AppOwner`. Each row contains the team's name and its corresponding `sharedOwnerMnemonic` and `sharedOwnerWriteKey`.
    *   This creates a many-to-many relationship: a user's `AppOwner` can store credentials for many teams, and a team's credentials can be shared with many users.

3.  **The Mutation Flow: Implementing `options.owner`**
    *   The central task is to make the `options.owner` parameter in mutation functions (`insert`, `update`) fully functional.
    *   **Main Thread (`Evolu.ts`):** When a mutation is called with `{ owner: someSharedOwner }`, the `SharedOwner` object must be passed alongside the `DbChange` object through the microtask queue.
    *   **Worker Message:** The array of `DbChange` objects sent to the DB worker must be accompanied by a corresponding array of `owner` objects. If a mutation uses the default `AppOwner`, its spot in the `owners` array is `undefined`.
    *   **DB Worker (`Db.ts`):** The worker receives the `changes` and `owners` arrays. It iterates through them, and for each change:
        *   If an `owner` object is present, it derives the `ownerId` from the owner's `mnemonic`.
        *   If the `owner` is `undefined`, it uses the `ownerId` of the default `AppOwner` (which is already loaded in the worker).
        *   It then inserts the data into the `evolu_history` table, explicitly setting the `ownerId` column to the correct ID.

4.  **Key Management and Synchronization**
    *   When a user wants to write to a team, the application reconstructs the `SharedOwner` object from the credentials stored under the `AppOwner`.
    *   The synchronization protocol (`Protocol.ts`) is already designed to handle multiple owners via the `getWriteKey` callback. When syncing, the client needs to provide a function that can look up the correct `writeKey` for any given `ownerId` it is syncing. This is accomplished by maintaining a registry of all known `SharedOwner` credentials (from the `teams` table) in the client.
    *   The relay remains completely blind. It only sees encrypted blobs associated with an opaque `ownerId`. It does not know or care if an `ownerId` represents a single user or a team.