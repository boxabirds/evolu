import { expect, test, describe, vi } from "vitest";
import { 
  createGroupSyncOpenHandler,
  createGroupSyncMessageHandler,
  wrapSyncHandlersForGroups,
  type GroupOwnerRowRef,
  type GroupSyncDeps
} from "../src/Evolu/GroupSyncHandler.js";
import type { GroupStorage } from "../src/Evolu/GroupProtocolHandler.js";
import type { SyncConfig } from "../src/Evolu/Sync.js";
import type { ProtocolMessage, Storage } from "../src/Evolu/Protocol.js";
import * as Protocol from "../src/Evolu/Protocol.js";
import type { GroupId } from "../src/Evolu/GroupSchema.js";
import { ok } from "../src/Result.js";
import type { OwnerRow } from "../src/Evolu/Owner.js";

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
      getGroupId: () => null,
      validateGroupAccess: () => false,
      getGroupEpoch: () => 0,
    };

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
    const mockMessage = new Uint8Array([1, 2, 3]) as ProtocolMessage;
    
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

  test("createGroupSyncOpenHandler detects group owner", () => {
    const deps = createMockDeps();
    const originalGet = deps.ownerRowRef.get;
    deps.ownerRowRef.get = () => ({
      ...originalGet(),
      groupId: "group-123" as GroupId,
    });
    
    const sendMock = vi.fn();
    const mockMessage = new Uint8Array([1, 2, 3]) as ProtocolMessage;
    
    // Mock createProtocolMessageForSync
    vi.spyOn(Protocol, 'createProtocolMessageForSync').mockImplementation(
      () => () => mockMessage
    );
    
    const handler = createGroupSyncOpenHandler(deps);
    handler(sendMock);
    
    // Should log group detection
    expect(deps.console.log).toHaveBeenCalledWith(
      "[db]",
      "group sync detected",
      "group-123"
    );
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

  test("wrapSyncHandlersForGroups returns config unchanged in Phase 1", () => {
    const mockConfig: SyncConfig = {
      syncUrl: "wss://example.com",
      onOpen: vi.fn(),
      onMessage: vi.fn(),
    };
    
    const wrappedConfig = wrapSyncHandlersForGroups(mockConfig);
    
    // In Phase 1, it should return the same config
    expect(wrappedConfig).toBe(mockConfig);
  });
});