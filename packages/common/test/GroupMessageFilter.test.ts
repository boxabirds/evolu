import { expect, test, describe, vi } from "vitest";
import {
  filterEncryptedMessagesByGroup,
  validateMemberEpochAccess,
  filterRangesByGroupAccess,
  getMessageVisibility,
  createGroupMessageFilter,
  createGroupMessageRouter,
  defaultGroupPartitionStrategy,
  type GroupFilterCriteria,
  type GroupMessageVisibility,
} from "../src/Evolu/GroupMessageFilter.js";
import type { GroupStorage } from "../src/Evolu/GroupProtocolHandler.js";
import type {
  EncryptedCrdtMessage,
  BinaryOwnerId,
  Range,
} from "../src/Evolu/Protocol.js";
import type { GroupId } from "../src/Evolu/GroupTypes.js";
import { NonEmptyString, NonNegativeInt } from "../src/Type.js";
import { ok, err } from "../src/Result.js";
import type { SqliteError } from "../src/Sqlite.js";

describe("GroupMessageFilter", () => {
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
      getGroupEpoch: vi.fn(() => ok(0 as typeof NonNegativeInt.Type)),
      validateGroupOperation: vi.fn(() => ok(true)),
      recordGroupActivity: vi.fn(() => ok()),
      ...overrides,
    } as unknown as GroupStorage;
  };

  const createTestMessages = (count: number): EncryptedCrdtMessage[] => {
    return Array.from({ length: count }, (_, i) => ({
      data: `message-${i}`,
    })) as any;
  };

  describe("filterEncryptedMessagesByGroup", () => {
    test("returns all messages in Phase 1", () => {
      const storage = createMockGroupStorage();
      const messages = createTestMessages(3);
      const criteria: GroupFilterCriteria = {
        groupId: "group-123" as GroupId,
        epochNumber: 1 as typeof NonNegativeInt.Type,
      };

      const result = filterEncryptedMessagesByGroup(messages, criteria, storage);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(messages);
      }
    });
  });

  describe("validateMemberEpochAccess", () => {
    test("validates member access to epoch", () => {
      const storage = createMockGroupStorage({
        validateGroupAccess: vi.fn(() => ok(true)),
      });

      const result = validateMemberEpochAccess(
        "member-123" as typeof NonEmptyString.Type,
        "group-123" as GroupId,
        5 as typeof NonNegativeInt.Type,
        storage
      );

      expect(result).toEqual(ok(true));
      expect(storage.validateGroupAccess).toHaveBeenCalledWith(
        "member-123",
        "group-123",
        5
      );
    });

    test("returns false when member has no access", () => {
      const storage = createMockGroupStorage({
        validateGroupAccess: vi.fn(() => ok(false)),
      });

      const result = validateMemberEpochAccess(
        "member-123" as typeof NonEmptyString.Type,
        "group-123" as GroupId,
        5 as typeof NonNegativeInt.Type,
        storage
      );

      expect(result).toEqual(ok(false));
    });
  });

  describe("filterRangesByGroupAccess", () => {
    test("returns empty ranges when member has no access", () => {
      const storage = createMockGroupStorage({
        validateGroupAccess: vi.fn(() => ok(false)),
      });

      const ranges: Range[] = [
        { type: "Skip", upper: new Uint8Array() },
        { type: "Fingerprint", upper: new Uint8Array(), fingerprint: new Uint8Array() },
      ];

      const result = filterRangesByGroupAccess(
        ranges,
        "group-123" as GroupId,
        "member-123" as typeof NonEmptyString.Type,
        2 as typeof NonNegativeInt.Type,
        storage
      );

      expect(result).toEqual(ok([]));
    });

    test("returns all ranges when member has access", () => {
      const storage = createMockGroupStorage({
        validateGroupAccess: vi.fn(() => ok(true)),
      });

      const ranges: Range[] = [
        { type: "Skip", upper: new Uint8Array() },
      ];

      const result = filterRangesByGroupAccess(
        ranges,
        "group-123" as GroupId,
        "member-123" as typeof NonEmptyString.Type,
        2 as typeof NonNegativeInt.Type,
        storage
      );

      expect(result).toEqual(ok(ranges));
    });
  });

  describe("getMessageVisibility", () => {
    test("returns full access for authorized member", () => {
      const storage = createMockGroupStorage({
        getGroupEpoch: vi.fn(() => ok(3 as typeof NonNegativeInt.Type)),
        validateGroupAccess: vi.fn(() => ok(true)),
      });

      const result = getMessageVisibility(
        "member-123" as typeof NonEmptyString.Type,
        "group-123" as GroupId,
        storage
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const visibility = result.value;
        expect(visibility.canRead).toBe(true);
        expect(visibility.canWrite).toBe(true);
        expect(visibility.epochRange).toEqual({
          minEpoch: 3,
          maxEpoch: 3,
        });
      }
    });

    test("returns no access for unauthorized member", () => {
      const storage = createMockGroupStorage({
        getGroupEpoch: vi.fn(() => ok(3 as typeof NonNegativeInt.Type)),
        validateGroupAccess: vi.fn(() => ok(false)),
      });

      const result = getMessageVisibility(
        "member-123" as typeof NonEmptyString.Type,
        "group-123" as GroupId,
        storage
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const visibility = result.value;
        expect(visibility.canRead).toBe(false);
        expect(visibility.canWrite).toBe(false);
        expect(visibility.epochRange).toBeUndefined();
      }
    });
  });

  describe("createGroupMessageFilter", () => {
    test("filters outgoing messages based on recipient access", () => {
      const storage = createMockGroupStorage({
        getGroupEpoch: vi.fn(() => ok(2 as typeof NonNegativeInt.Type)),
        validateGroupAccess: vi.fn(() => ok(true)),
      });

      const filter = createGroupMessageFilter(storage);
      const messages = createTestMessages(3);

      const result = filter.filterOutgoing(
        messages,
        "recipient-123" as typeof NonEmptyString.Type,
        "group-123" as GroupId
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(messages);
      }
    });

    test("returns empty array for recipients without access", () => {
      const storage = createMockGroupStorage({
        getGroupEpoch: vi.fn(() => ok(2 as typeof NonNegativeInt.Type)),
        validateGroupAccess: vi.fn(() => ok(false)),
      });

      const filter = createGroupMessageFilter(storage);
      const messages = createTestMessages(3);

      const result = filter.filterOutgoing(
        messages,
        "recipient-123" as typeof NonEmptyString.Type,
        "group-123" as GroupId
      );

      expect(result).toEqual(ok([]));
    });

    test("validates incoming messages from authorized senders", () => {
      const storage = createMockGroupStorage({
        getGroupEpoch: vi.fn(() => ok(2 as typeof NonNegativeInt.Type)),
        validateGroupAccess: vi.fn(() => ok(true)),
      });

      const filter = createGroupMessageFilter(storage);
      const messages = createTestMessages(2);

      const result = filter.validateIncoming(
        messages,
        "sender-123" as typeof NonEmptyString.Type,
        "group-123" as GroupId
      );

      expect(result).toEqual(ok(true));
    });
  });

  describe("createGroupMessageRouter", () => {
    test("routes messages to group partitions", () => {
      const router = createGroupMessageRouter();
      const message = { data: "test" } as any;

      // Test with group context
      const groupContext = {
        groupId: "group-123" as GroupId,
        epochNumber: 2 as typeof NonNegativeInt.Type,
      };
      const groupRoute = router.route(message, groupContext);
      expect(groupRoute).toBe("group:group-123:2");

      // Test without group context
      const defaultRoute = router.route(message, null);
      expect(defaultRoute).toBe("default");
    });

    test("partitions messages by group", () => {
      const router = createGroupMessageRouter();
      const messages = createTestMessages(4);

      const getContext = (message: EncryptedCrdtMessage) => {
        const index = parseInt((message as any).data.split("-")[1]);
        if (index < 2) {
          return {
            groupId: "group-A" as GroupId,
            epochNumber: 1 as typeof NonNegativeInt.Type,
          };
        } else if (index === 2) {
          return {
            groupId: "group-B" as GroupId,
            epochNumber: 2 as typeof NonNegativeInt.Type,
          };
        }
        return null;
      };

      const partitions = router.partition(messages, getContext);

      expect(partitions.size).toBe(3);
      expect(partitions.get("group:group-A:1")).toHaveLength(2);
      expect(partitions.get("group:group-B:2")).toHaveLength(1);
      expect(partitions.get("default")).toHaveLength(1);
    });
  });

  describe("defaultGroupPartitionStrategy", () => {
    test("creates partition key from group and epoch", () => {
      const context = {
        groupId: "group-123" as GroupId,
        epochNumber: 5 as typeof NonNegativeInt.Type,
      };

      const key = defaultGroupPartitionStrategy.getPartitionKey(context);
      expect(key).toBe("group-123:5");
    });

    test("always isolates group messages", () => {
      const context = {
        groupId: "group-123" as GroupId,
        epochNumber: 1 as typeof NonNegativeInt.Type,
      };

      expect(defaultGroupPartitionStrategy.shouldIsolate(context)).toBe(true);
    });
  });
});