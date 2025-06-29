import { expect, test, describe, vi } from "vitest";
import { 
  routeMessageToPartition,
  createGroupClientHandler,
  createGroupRelayHandler,
  createGroupSyncHandler,
  filterGroupMessages,
  requiresGroupProcessing,
  type GroupStorage,
  type GroupProtocolError,
} from "../src/Evolu/GroupProtocolHandler.js";
import type { 
  ProtocolMessage,
  BinaryOwnerId,
  EncryptedCrdtMessage,
  applyProtocolMessageAsClient,
  applyProtocolMessageAsRelay,
  createProtocolMessageForSync,
} from "../src/Evolu/Protocol.js";
import { 
  type GroupProtocolMessage,
  type GroupOperationMetadata,
} from "../src/Evolu/GroupProtocolMessage.js";
import type { GroupId } from "../src/Evolu/GroupTypes.js";
import { ok, err } from "../src/Result.js";
import { NonEmptyString, NonNegativeInt } from "../src/Type.js";
import { protocolVersion } from "../src/Evolu/Protocol.js";
import type { SqliteError } from "../src/Sqlite.js";

describe("GroupProtocolHandler", () => {
  const createMockGroupStorage = (
    overrides?: Partial<GroupStorage>
  ): GroupStorage => {
    return {
      // Base Storage methods (minimal mocks)
      getSize: vi.fn(() => ok(0)),
      fingerprint: vi.fn(() => ok(new Uint8Array())),
      fingerprintRanges: vi.fn(() => ok([])),
      findLowerBound: vi.fn(() => ok(null)),
      iterate: vi.fn(),
      validateWriteKey: vi.fn(() => ok(true)),
      setWriteKey: vi.fn(() => ok()),
      writeMessages: vi.fn(() => ok()),
      readDbChange: vi.fn(() => ok(null)),
      deleteOwner: vi.fn(() => ok()),
      // Group-specific methods
      getGroupId: vi.fn(() => ok(null)),
      validateGroupAccess: vi.fn(() => ok(true)),
      getGroupEpoch: vi.fn(() => ok(5 as typeof NonNegativeInt.Type)),
      validateGroupOperation: vi.fn(() => ok(true)),
      recordGroupActivity: vi.fn(() => ok()),
      ...overrides,
    } as unknown as GroupStorage;
  };
  
  const createTestProtocolMessage = (
    overrides?: Partial<ProtocolMessage>
  ): ProtocolMessage => {
    return {
      protocolVersion,
      ownerId: "owner123" as unknown as BinaryOwnerId,
      messages: [],
      ranges: [],
      ...overrides,
    } as ProtocolMessage;
  };
  
  const createTestGroupMessage = (
    groupId: GroupId = "group-123" as GroupId,
    epochNumber: number = 1
  ): GroupProtocolMessage => {
    return {
      ...createTestProtocolMessage(),
      groupId,
      epochNumber: epochNumber as typeof NonNegativeInt.Type,
    };
  };

  test("routeMessageToPartition routes regular messages to default", () => {
    const storage = createMockGroupStorage();
    const message = new Uint8Array([1, 2, 3]) as ProtocolMessage;
    
    const partition = routeMessageToPartition(message, storage);
    expect(partition).toBe("default");
  });
  
  test("routeMessageToPartition routes group messages to group partition", () => {
    const storage = createMockGroupStorage();
    const groupMessage = createTestGroupMessage("group-123" as GroupId, 5);
    
    const partition = routeMessageToPartition(groupMessage, storage);
    expect(partition).toBe("group:group-123:5");
  });
  
  describe("createGroupClientHandler", () => {
    test("validates group access for group messages", () => {
      const storage = createMockGroupStorage({
        validateGroupAccess: vi.fn(() => ok(false)),
      });
      
      const originalHandler = vi.fn(() => ok({ messages: [] })) as any;
      const groupHandler = createGroupClientHandler(originalHandler, storage);
      
      const groupMessage = createTestGroupMessage();
      const result = groupHandler(groupMessage, { getWriteKey: () => null });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("GroupProtocolError");
        expect((result.error as GroupProtocolError).reason).toBe("access_denied");
      }
      expect(originalHandler).not.toHaveBeenCalled();
    });
    
    test("processes group operations when valid", () => {
      const storage = createMockGroupStorage();
      const originalHandler = vi.fn(() => ok({ messages: [] })) as ReturnType<typeof applyProtocolMessageAsClient>;
      const groupHandler = createGroupClientHandler(originalHandler, storage);
      
      const groupMessage: GroupProtocolMessage = {
        ...createTestGroupMessage(),
        groupOperation: {
          operation: "member_add",
          groupId: "group-123" as GroupId,
          epochNumber: 1 as typeof NonNegativeInt.Type,
          actorId: "user-123" as typeof NonEmptyString.Type,
        },
      };
      
      const result = groupHandler(groupMessage, { getWriteKey: () => null });
      
      expect(result.ok).toBe(true);
      expect(storage.recordGroupActivity).toHaveBeenCalledWith(
        "group-123",
        "user-123",
        "member_add",
        1,
        undefined,
        undefined
      );
      expect(originalHandler).toHaveBeenCalled();
    });
    
    test("passes through non-group messages", () => {
      const storage = createMockGroupStorage();
      const originalHandler = vi.fn(() => ok({ messages: [] })) as any;
      const groupHandler = createGroupClientHandler(originalHandler, storage);
      
      const regularMessage = createTestProtocolMessage();
      const result = groupHandler(regularMessage, { getWriteKey: () => null });
      
      expect(result.ok).toBe(true);
      expect(storage.validateGroupAccess).not.toHaveBeenCalled();
      expect(originalHandler).toHaveBeenCalledWith(
        regularMessage,
        { getWriteKey: expect.any(Function) }
      );
    });
  });
  
  describe("createGroupSyncHandler", () => {
    test("enhances sync messages with group context", () => {
      const groupId = "group-123" as GroupId;
      const storage = createMockGroupStorage({
        getGroupId: vi.fn(() => ok(groupId)),
        getGroupEpoch: vi.fn(() => ok(3 as typeof NonNegativeInt.Type)),
      });
      
      const originalHandler = vi.fn(() => 
        ok(createTestProtocolMessage())
      ) as any;
      const groupHandler = createGroupSyncHandler(originalHandler, storage);
      
      const ownerId = "owner123" as unknown as BinaryOwnerId;
      const result = groupHandler(ownerId, [], {});
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        const message = result.value as GroupProtocolMessage;
        expect(message.groupId).toBe(groupId);
        expect(message.epochNumber).toBe(3);
      }
    });
    
    test("uses original handler for non-group owners", () => {
      const storage = createMockGroupStorage({
        getGroupId: vi.fn(() => ok(null)),
      });
      
      const originalMessage = createTestProtocolMessage();
      const originalHandler = vi.fn(() => ok(originalMessage)) as any;
      const groupHandler = createGroupSyncHandler(originalHandler, storage);
      
      const ownerId = "owner123" as unknown as BinaryOwnerId;
      const result = groupHandler(ownerId, [], {});
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(originalMessage);
        expect((result.value as any).groupId).toBeUndefined();
      }
    });
  });
  
  describe("filterGroupMessages", () => {
    test("returns all messages in Phase 1", () => {
      const messages: EncryptedCrdtMessage[] = [
        { data: "msg1" } as any,
        { data: "msg2" } as any,
        { data: "msg3" } as any,
      ];
      
      const filtered = filterGroupMessages(
        messages,
        "group-123" as GroupId,
        2 as typeof NonNegativeInt.Type
      );
      
      expect(filtered).toEqual(messages);
    });
  });
  
  describe("requiresGroupProcessing", () => {
    test("identifies messages requiring group processing", () => {
      const regularMessage = createTestProtocolMessage();
      expect(requiresGroupProcessing(regularMessage)).toBe(false);
      
      const groupMessage = createTestGroupMessage();
      expect(requiresGroupProcessing(groupMessage)).toBe(true);
      
      const partialGroupMessage = {
        ...createTestProtocolMessage(),
        groupId: undefined,
      } as GroupProtocolMessage;
      expect(requiresGroupProcessing(partialGroupMessage)).toBe(false);
    });
  });
});