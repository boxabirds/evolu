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
import { NonEmptyString, NonNegativeInt } from "../src/Type.js";
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
      getGroupId: vi.fn(() => ok(null)),
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
      groupId: undefined,
    };

    return {
      storage: mockStorage,
      groupStorage: mockGroupStorage,
      console: {
        log: vi.fn(),
        error: vi.fn(),
      },
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
    const mockMessage: ProtocolMessage = {
      protocolVersion,
      ownerId: "owner123" as unknown as BinaryOwnerId,
      messages: [],
      ranges: [],
    };
    
    // Mock createProtocolMessageForSync
    vi.spyOn(Protocol, 'createProtocolMessageForSync').mockImplementation(
      () => () => ok(mockMessage)
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
    deps.groupStorage!.getGroupId = vi.fn(() => ok("group-123" as GroupId));
    deps.groupStorage!.getGroupEpoch = vi.fn(() => ok(3 as typeof NonNegativeInt.Type));
    
    const sendMock = vi.fn();
    const baseMessage: ProtocolMessage = {
      protocolVersion,
      ownerId: "owner123" as unknown as BinaryOwnerId,
      messages: [],
      ranges: [],
    };
    
    // Mock createProtocolMessageForSync
    vi.spyOn(Protocol, 'createProtocolMessageForSync').mockImplementation(
      () => () => ok(baseMessage)
    );
    
    const handler = createGroupSyncOpenHandler(deps);
    handler(sendMock);
    
    // Should log group context
    expect(deps.console.log).toHaveBeenCalledWith(
      "[db]",
      "group sync open",
      {
        groupId: "group-123",
        epochNumber: 3,
      }
    );
    
    // Should send enhanced message
    const sentMessage = sendMock.mock.calls[0][0] as GroupProtocolMessage;
    expect(sentMessage.groupId).toBe("group-123");
    expect(sentMessage.epochNumber).toBe(3);
  });

  test("createGroupSyncMessageHandler processes incoming messages", () => {
    const deps = createMockDeps();
    const sendMock = vi.fn();
    const testMessage = new Uint8Array([1, 2, 3]);
    
    // Mock applyProtocolMessageAsClient
    vi.spyOn(Protocol, 'applyProtocolMessageAsClient').mockReturnValue(
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
    expect(config.onError).toBeDefined();
    expect(config.onClose).toBeDefined();
  });
  
  test("filterGroupSyncRanges returns ranges unchanged in Phase 1", () => {
    const deps = createMockDeps();
    const ranges: Range[] = [
      { type: "Skip", upper: new Uint8Array() },
      { type: "Fingerprint", upper: new Uint8Array(), fingerprint: new Uint8Array() },
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
    
    // Test non-group owner
    deps.groupStorage!.getGroupId = vi.fn(() => ok(null));
    const result1 = shouldSyncGroupData(
      "owner-123" as OwnerId,
      deps.groupStorage!
    );
    expect(result1).toEqual(ok(false));
    
    // Test group owner
    deps.groupStorage!.getGroupId = vi.fn(() => ok("group-123" as GroupId));
    const result2 = shouldSyncGroupData(
      "owner-123" as OwnerId,
      deps.groupStorage!
    );
    expect(result2).toEqual(ok(true));
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