import { expect, test, describe, vi } from "vitest";
import { 
  initializeGroupTables,
  createGroupAwareStorage,
  handleGroupDbWorkerMessage,
  type GroupDbWorkerInput,
  type GroupDbWorkerOutput
} from "../src/Evolu/GroupDbExtensions.js";
import type { Config } from "../src/Evolu/Config.js";
import type { GroupConfig } from "../src/Evolu/GroupConfig.js";
import type { SqliteDep } from "../src/Sqlite.js";
import { ok, err } from "../src/Result.js";
import { sql } from "../src/Sqlite.js";

describe("GroupDbExtensions", () => {
  const createMockSqliteDep = (): SqliteDep => ({
    sqlite: {
      exec: vi.fn(() => ok({ rows: [], changes: 0 })),
      transaction: vi.fn((fn) => fn()),
    } as any,
  });

  test("initializeGroupTables skips when groups disabled", () => {
    const deps = createMockSqliteDep();
    const config: Config = {
      syncUrl: "wss://example.com",
      isSynced: false,
      log: false,
    };
    
    const result = initializeGroupTables(deps, config);
    expect(result.ok).toBe(true);
    
    // Should not execute any SQL
    expect(deps.sqlite.exec).not.toHaveBeenCalled();
  });

  test("initializeGroupTables creates tables when groups enabled", () => {
    const deps = createMockSqliteDep();
    const config: GroupConfig = {
      syncUrl: "wss://example.com",
      isSynced: false,
      log: false,
      enableGroups: true,
    };
    
    // Mock table existence check to return false
    vi.spyOn(deps.sqlite, 'exec')
      .mockImplementationOnce(() => ok({ rows: [], changes: 0 })); // First call for existence check
    
    const result = initializeGroupTables(deps, config);
    expect(result.ok).toBe(true);
    
    // Should have called exec for table creation
    expect(deps.sqlite.exec).toHaveBeenCalled();
  });

  test("createGroupAwareStorage adds group methods", () => {
    const deps = createMockSqliteDep();
    const baseStorage = {
      getSize: () => null,
      someMethod: () => "test",
    };
    
    const groupStorage = createGroupAwareStorage(baseStorage, deps);
    
    // Should preserve base storage methods
    expect(groupStorage.getSize).toBe(baseStorage.getSize);
    expect(groupStorage.someMethod).toBe(baseStorage.someMethod);
    
    // Should add group methods
    expect(groupStorage.getGroupId).toBeDefined();
    expect(groupStorage.validateGroupAccess).toBeDefined();
    expect(groupStorage.getGroupEpoch).toBeDefined();
    
    // Phase 1 implementations return defaults
    expect(groupStorage.getGroupId?.("owner-123" as any)).toEqual({ ok: true, value: null });
    expect(groupStorage.validateGroupAccess?.("owner-123" as any, "group-123" as any)).toEqual({ ok: true, value: false });
    expect(groupStorage.getGroupEpoch?.("group-123" as any)).toEqual({ ok: true, value: 0 });
  });

  test("handleGroupDbWorkerMessage handles createGroup", () => {
    const postMessageMock = vi.fn();
    const message: GroupDbWorkerInput = {
      type: "createGroup",
      name: "Test Group",
      members: ["user1", "user2"],
    };
    
    const handled = handleGroupDbWorkerMessage(message, postMessageMock);
    
    expect(handled).toBe(true);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "onGroupCreated",
      groupId: "group-placeholder",
    });
  });

  test("handleGroupDbWorkerMessage handles joinGroup", () => {
    const postMessageMock = vi.fn();
    const message: GroupDbWorkerInput = {
      type: "joinGroup",
      groupId: "group-123",
      inviteCode: "invite-abc",
    };
    
    const handled = handleGroupDbWorkerMessage(message, postMessageMock);
    
    expect(handled).toBe(true);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "onGroupJoined",
      groupId: "group-123",
    });
  });

  test("handleGroupDbWorkerMessage handles leaveGroup", () => {
    const postMessageMock = vi.fn();
    const message: GroupDbWorkerInput = {
      type: "leaveGroup",
      groupId: "group-456",
    };
    
    const handled = handleGroupDbWorkerMessage(message, postMessageMock);
    
    expect(handled).toBe(true);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "onGroupLeft",
      groupId: "group-456",
    });
  });

  test("handleGroupDbWorkerMessage returns false for non-group messages", () => {
    const postMessageMock = vi.fn();
    const message = {
      type: "init",
      config: {} as Config,
    } as any;
    
    const handled = handleGroupDbWorkerMessage(message, postMessageMock);
    
    expect(handled).toBe(false);
    expect(postMessageMock).not.toHaveBeenCalled();
  });
});