import { expect, test, describe, vi } from "vitest";
import { createGroupAwareEvolu, isGroupAwareEvolu } from "../src/Evolu/GroupEvolu.js";
import type { Evolu } from "../src/Evolu/Evolu.js";
import type { EvoluSchema } from "../src/Evolu/Schema.js";
import type { GroupConfig } from "../src/Evolu/GroupConfig.js";
import type { GroupEvoluDeps } from "../src/Evolu/GroupEvolu.js";
import { hasGroupSupport, type EvoluWithGroups } from "../src/Evolu/GroupAPI.js";
import { createStore } from "../src/Store.js";
import { ok } from "../src/Result.js";
import { testCreateSqliteDriver, testSimpleName, testTime, testNanoIdLib, testRandom } from "./_deps.js";
import { createSqlite } from "../src/Sqlite.js";
import { getOrThrow } from "../src/Result.js";
import type { AppOwner } from "../src/Evolu/Owner.js";
import type { GroupId } from "../src/Evolu/GroupSchema.js";

describe("GroupAPI", () => {
  const createMockEvolu = (): Evolu<EvoluSchema> => {
    const ownerStore = createStore<AppOwner | null>({
      id: "user-123",
      encryptionKey: new Uint8Array(32),
      writeKey: new Uint8Array(16),
    } as AppOwner);

    return {
      subscribeError: vi.fn(),
      getError: vi.fn(() => null),
      createQuery: vi.fn(),
      loadQuery: vi.fn(),
      loadQueries: vi.fn(),
      subscribeQuery: vi.fn(),
      getQueryRows: vi.fn(),
      subscribeAppOwner: ownerStore.subscribe,
      getAppOwner: ownerStore.get,
      subscribeSyncState: vi.fn(),
      getSyncState: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      resetAppOwner: vi.fn(),
      restoreAppOwner: vi.fn(),
      exportDatabase: vi.fn(),
    } as unknown as Evolu<EvoluSchema>;
  };

  const createTestDeps = async (): Promise<GroupEvoluDeps> => {
    const sqliteResult = await createSqlite({
      createSqliteDriver: testCreateSqliteDriver,
    })(testSimpleName);
    const sqlite = getOrThrow(sqliteResult);

    return {
      sqlite,
      time: testTime,
      nanoIdLib: testNanoIdLib,
      random: testRandom,
    };
  };

  test("returns original evolu when groups are not enabled", async () => {
    const evolu = createMockEvolu();
    const config: GroupConfig = {
      name: testSimpleName,
      syncUrl: "wss://test.com",
      reloadUrl: "/",
      maxDrift: 5 * 60 * 1000,
      enableLogging: false,
      enableGroups: false,
    };
    const deps = await createTestDeps();

    const result = createGroupAwareEvolu(evolu, config, deps);
    
    expect(result).toBe(evolu);
    expect(hasGroupSupport(result)).toBe(false);
  });

  test("extends evolu with group support when enabled", async () => {
    const evolu = createMockEvolu();
    const config: GroupConfig = {
      name: testSimpleName,
      syncUrl: "wss://test.com",
      reloadUrl: "/",
      maxDrift: 5 * 60 * 1000,
      enableLogging: false,
      enableGroups: true,
    };
    const deps = await createTestDeps();

    const result = createGroupAwareEvolu(evolu, config, deps);
    
    expect(result).not.toBe(evolu);
    expect(hasGroupSupport(result)).toBe(true);
    
    if (hasGroupSupport(result)) {
      expect(result.supportsGroups).toBe(true);
      expect(result.createGroup).toBeDefined();
      expect(result.joinGroup).toBeDefined();
      expect(result.leaveGroup).toBeDefined();
      expect(result.getCurrentGroup).toBeDefined();
      expect(result.setCurrentGroup).toBeDefined();
      expect(result.listGroups).toBeDefined();
      expect(result.subscribeCurrentGroup).toBeDefined();
      expect(result.getGroup).toBeDefined();
      expect(result.generateGroupInvite).toBeDefined();
    }
  });

  test("current group context management", async () => {
    const evolu = createMockEvolu();
    const config: GroupConfig = {
      name: testSimpleName,
      syncUrl: "wss://test.com",
      reloadUrl: "/",
      maxDrift: 5 * 60 * 1000,
      enableLogging: false,
      enableGroups: true,
    };
    const deps = await createTestDeps();

    const result = createGroupAwareEvolu(evolu, config, deps);
    
    if (hasGroupSupport(result)) {
      // Initially no current group
      expect(result.getCurrentGroup()).toBe(null);
      
      // Set current group
      const groupContext = { 
        groupId: "group-123" as GroupId, 
        role: "admin" as const 
      };
      result.setCurrentGroup(groupContext);
      expect(result.getCurrentGroup()).toEqual(groupContext);
      
      // Clear current group
      result.setCurrentGroup(null);
      expect(result.getCurrentGroup()).toBe(null);
    }
  });

  test("subscribes to current group changes", async () => {
    const evolu = createMockEvolu();
    const config: GroupConfig = {
      name: testSimpleName,
      syncUrl: "wss://test.com",
      reloadUrl: "/",
      maxDrift: 5 * 60 * 1000,
      enableLogging: false,
      enableGroups: true,
    };
    const deps = await createTestDeps();

    const result = createGroupAwareEvolu(evolu, config, deps);
    
    if (hasGroupSupport(result)) {
      let callCount = 0;
      const unsubscribe = result.subscribeCurrentGroup(() => {
        callCount++;
      });
      
      const groupContext = { 
        groupId: "group-123" as GroupId, 
        role: "member" as const 
      };
      
      result.setCurrentGroup(groupContext);
      expect(callCount).toBe(1);
      
      result.setCurrentGroup(null);
      expect(callCount).toBe(2);
      
      unsubscribe();
      result.setCurrentGroup(groupContext);
      expect(callCount).toBe(2); // Should not increase after unsubscribe
    }
  });

  test("isGroupAwareEvolu type guard", async () => {
    const evolu = createMockEvolu();
    const config: GroupConfig = {
      name: testSimpleName,
      syncUrl: "wss://test.com",
      reloadUrl: "/",
      maxDrift: 5 * 60 * 1000,
      enableLogging: false,
      enableGroups: true,
    };
    const deps = await createTestDeps();

    const regularEvolu = createGroupAwareEvolu(evolu, { ...config, enableGroups: false }, deps);
    const groupEvolu = createGroupAwareEvolu(evolu, config, deps);
    
    expect(isGroupAwareEvolu(regularEvolu)).toBe(false);
    expect(isGroupAwareEvolu(groupEvolu)).toBe(true);
  });
});