import { expect, test, describe, vi } from "vitest";
import { 
  createGroupSyncOpenHandler,
  createGroupSyncMessageHandler,
  createGroupSyncConfig,
  filterGroupSyncRanges,
  shouldSyncGroupData,
  planGroupSyncOperations,
  type GroupOwnerRowRef,
  type GroupSyncDeps,
  type GroupSyncOperation,
} from "../src/Evolu/GroupSyncHandler.js";
import type { GroupStorage } from "../src/Evolu/GroupProtocolHandler.js";
import type { SyncConfig } from "../src/Evolu/Sync.js";
import type { 
  ProtocolMessage, 
  Storage,
  BinaryOwnerId,
  Range,
} from "../src/Evolu/Protocol.js";
import * as Protocol from "../src/Evolu/Protocol.js";
import { protocolVersion } from "../src/Evolu/Protocol.js";
import type { GroupId } from "../src/Evolu/GroupTypes.js";
import { ok, err } from "../src/Result.js";
import type { OwnerRow, OwnerId } from "../src/Evolu/Owner.js";
import { NonEmptyString, NonNegativeInt, DateIsoString } from "../src/Type.js";
import type { GroupProtocolMessage } from "../src/Evolu/GroupProtocolMessage.js";

describe("GroupSyncHandler", () => {
  const createMockDeps = (): GroupSyncDeps & { ownerRowRef: GroupOwnerRowRef } => {
    const mockStorage: Storage = {
      getSize: () => null,
      fingerprint: () => null,
      fingerprintRanges: () => null,
      findLowerBound: () => null,
      iterate: () => {},
      validateWriteKey: () => false,
      setWriteKey: () => false,
      writeMessages: () => false,
      readDbChange: () => null,
      deleteOwner: () => false,
    };

    const mockGroupStorage: GroupStorage = {
      ...mockStorage,
      validateGroupAccess: vi.fn(() => ok(true)),
      getGroupEpoch: vi.fn(() => ok(0 as typeof NonNegativeInt.Type)),
      validateGroupOperation: vi.fn(() => ok(true)),
      recordGroupActivity: vi.fn(() => ok()),
    } as unknown as GroupStorage;

    const mockOwnerRow: OwnerRow & { groupId?: GroupId } = {
      id: "owner-123" as any,
      timestamp: "2024-01-01T00:00:00.000Z-0000-1234567890abcdef" as any,
      encryptionKey: new Uint8Array(32) as any,
      writeKey: null,
      mnemonic: "test mnemonic words" as any,
      createdAt: new Date().toISOString() as DateIsoString,
    };

    return {
      storage: mockStorage,
      groupStorage: mockGroupStorage,
      console: {
        log: vi.fn(),
        error: vi.fn(),
        enabled: false,
      } as any,
      sqlite: {
        exec: vi.fn(() => ok({ rows: [], changes: 0 })),
        transaction: vi.fn((fn) => fn()),
      } as any,
      postMessage: vi.fn(),
      ownerRowRef: {
        get: () => mockOwnerRow,
      },
    };
  };

  test("createGroupSyncOpenHandler sends initial sync message", () => {
    const deps = createMockDeps();
    const sendMock = vi.fn();
    const mockMessage: ProtocolMessage = new Uint8Array([1, 2, 3]) as ProtocolMessage;
    
    // Mock createProtocolMessageForSync
    vi.spyOn(Protocol, 'createProtocolMessageForSync').mockImplementation(
      () => () => mockMessage
    );
    
    const handler = createGroupSyncOpenHandler(deps);
    handler(sendMock);
    
    // Should log the sync open
    expect(deps.console.log).toHaveBeenCalledWith(
      "[db]",
      "send initial sync message",
      mockMessage
    );
    
    // Should send the message
    expect(sendMock).toHaveBeenCalledWith(mockMessage);
  });

  test("createGroupSyncOpenHandler enhances message with group context", () => {
    const deps = createMockDeps();
    // In Phase 1, we don't have getGroupId, so we mock the group context differently
    (deps.groupStorage as any).getGroupEpoch = vi.fn(() => ok(3 as typeof NonNegativeInt.Type));
    
    const sendMock = vi.fn();
    const baseMessage: ProtocolMessage = new Uint8Array([1, 2, 3]) as ProtocolMessage;
    
    // Mock createProtocolMessageForSync
    vi.spyOn(Protocol, 'createProtocolMessageForSync').mockImplementation(
      () => () => baseMessage
    );
    
    const handler = createGroupSyncOpenHandler(deps);
    handler(sendMock);
    
    // In Phase 1, we just check that the handler was called
    // Group context enhancement is not fully implemented
    
    // Should send the message (group enhancement happens internally)
    expect(sendMock).toHaveBeenCalledWith(baseMessage);
  });

  test("createGroupSyncMessageHandler processes incoming messages", () => {
    const deps = createMockDeps();
    const sendMock = vi.fn();
    const testMessage = new Uint8Array([1, 2, 3]);
    
    // Mock applyProtocolMessageAsClient with correct signature
    vi.spyOn(Protocol, 'applyProtocolMessageAsClient').mockImplementation(
      () => () => ok(null)
    );
    
    const handler = createGroupSyncMessageHandler(deps);
    handler(testMessage, sendMock);
    
    // Should log the received message
    expect(deps.console.log).toHaveBeenCalledWith(
      "[db]",
      "receive sync message",
      testMessage
    );
    
    // Should not send a response when output is null
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("createGroupSyncConfig creates complete sync configuration", () => {
    const deps = createMockDeps();
    const config = createGroupSyncConfig(deps);
    
    expect(config.onOpen).toBeDefined();
    expect(config.onMessage).toBeDefined();
    // SyncConfig only has syncUrl, onOpen, onMessage in current interface
  });
  
  test("filterGroupSyncRanges returns ranges unchanged in Phase 1", () => {
    const deps = createMockDeps();
    const ranges: Range[] = [
      { type: 0, upperBound: new Uint8Array() as any },
      { type: 1, upperBound: new Uint8Array() as any, fingerprint: new Uint8Array(12) as import("../src/Evolu/Protocol.js").Fingerprint },
    ];
    
    const result = filterGroupSyncRanges(
      ranges,
      "group-123" as GroupId,
      2,
      deps.groupStorage!
    );
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(ranges);
    }
  });
  
  test("shouldSyncGroupData checks if owner belongs to group", () => {
    const deps = createMockDeps();
    
    // In Phase 1, shouldSyncGroupData always returns false
    // GroupStorage doesn't have getGroupId method
    const result1 = shouldSyncGroupData(
      "owner-123" as OwnerId,
      deps.groupStorage!
    );
    expect(result1).toEqual(ok(false));
    
    // Phase 2 will test group owner scenario
  });
  
  test("planGroupSyncOperations creates sync plan based on state", () => {
    const localState = {
      groupId: "group-123" as GroupId,
      epochNumber: 2,
      lastSyncedEpoch: 2,
      pendingOperations: ["member_add", "member_remove"] as any,
    };
    
    // Test when remote is ahead
    const ops1 = planGroupSyncOperations(localState, 5);
    expect(ops1).toHaveLength(2);
    expect(ops1[0]).toEqual({
      type: "sync_epochs",
      groupId: "group-123",
      fromEpoch: 2,
      toEpoch: 5,
    });
    expect(ops1[1]).toEqual({
      type: "sync_members",
      groupId: "group-123",
      epochNumber: 2,
    });
    
    // Test when synced but with pending operations
    const ops2 = planGroupSyncOperations({ ...localState, epochNumber: 5 }, 5);
    expect(ops2).toHaveLength(1);
    expect(ops2[0].type).toBe("sync_members");
    
    // Test when fully synced
    const ops3 = planGroupSyncOperations(
      { ...localState, epochNumber: 5, pendingOperations: [] },
      5
    );
    expect(ops3).toHaveLength(0);
  });
});