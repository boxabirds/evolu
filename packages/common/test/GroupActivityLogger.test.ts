import { expect, test, describe, vi } from "vitest";
import {
  createGroupActivityLogger,
  createActivityMetadata,
  type GroupActivity,
  type GroupActivityLogger,
  type ActivityMetadata,
} from "../src/Evolu/GroupActivityLogger.js";
import type { SqliteDep } from "../src/Sqlite.js";
import type { TimeDep } from "../src/Time.js";
import type { NanoIdLibDep } from "../src/NanoId.js";
import type { GroupId } from "../src/Evolu/GroupTypes.js";
import { NonEmptyString, NonNegativeInt } from "../src/Type.js";
import { ok, err } from "../src/Result.js";

describe("GroupActivityLogger", () => {
  const createMockDeps = (): SqliteDep & TimeDep & NanoIdLibDep => {
    return {
      sqlite: {
        exec: vi.fn(() => ok({ rows: [], changes: 1 })),
        transaction: vi.fn((fn) => fn()),
      } as any,
      time: {
        now: vi.fn(() => 1234567890000),
      },
      nanoIdLib: {
        nanoid: vi.fn(() => "test-id-123"),
        urlAlphabet: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
        customAlphabet: vi.fn(() => vi.fn(() => "custom-id")),
      },
    };
  };

  const createTestGroupId = (): GroupId => "group-123" as GroupId;
  const createTestActorId = (): NonEmptyString => "user-123" as typeof NonEmptyString.Type;
  const createTestEpochNumber = (): NonNegativeInt => 1 as typeof NonNegativeInt.Type;

  describe("createGroupActivityLogger", () => {
    test("creates activity logger with all methods", () => {
      const deps = createMockDeps();
      const logger = createGroupActivityLogger(deps);

      expect(logger.log).toBeDefined();
      expect(logger.getActivities).toBeDefined();
      expect(logger.getActivitiesByActor).toBeDefined();
      expect(logger.getActivitiesForTarget).toBeDefined();
      expect(logger.cleanup).toBeDefined();
    });
  });

  describe("log", () => {
    test("logs activity to database", () => {
      const deps = createMockDeps();
      const logger = createGroupActivityLogger(deps);

      const result = logger.log(
        createTestGroupId(),
        createTestActorId(),
        "group_created",
        createTestEpochNumber(),
        undefined,
        createActivityMetadata.groupCreated("Test Group")
      );

      expect(result.ok).toBe(true);
      expect(deps.sqlite.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("insert into evolu_group_activity"),
        })
      );
    });

    test("logs activity with target user", () => {
      const deps = createMockDeps();
      const logger = createGroupActivityLogger(deps);

      const result = logger.log(
        createTestGroupId(),
        createTestActorId(),
        "member_added",
        createTestEpochNumber(),
        "target-user-123" as typeof NonEmptyString.Type,
        createActivityMetadata.memberAdded("member")
      );

      expect(result.ok).toBe(true);
      expect(deps.sqlite.exec).toHaveBeenCalled();
    });

    test("handles database error", () => {
      const deps = createMockDeps();
      const mockError = { type: "SqliteError", code: "INSERT_FAILED" };
      (deps.sqlite.exec as any) = vi.fn(() => err(mockError));
      
      const logger = createGroupActivityLogger(deps);

      const result = logger.log(
        createTestGroupId(),
        createTestActorId(),
        "group_created",
        createTestEpochNumber()
      );

      expect(result.ok).toBe(false);
    });
  });

  describe("getActivities", () => {
    test("retrieves activities for group", () => {
      const deps = createMockDeps();
      const mockActivities = [
        {
          id: "activity-1",
          groupId: "group-123",
          actorId: "user-123",
          action: "group_create",
          targetId: null,
          epochNumber: 1,
          timestamp: "2024-01-01T00:00:00.000Z",
          metadata: '{"type":"group_created","name":"Test Group"}',
        },
        {
          id: "activity-2",
          groupId: "group-123",
          actorId: "user-456",
          action: "member_add",
          targetId: "user-789",
          epochNumber: 1,
          timestamp: "2024-01-01T01:00:00.000Z",
          metadata: '{"type":"member_added","role":"member"}',
        },
      ];

      (deps.sqlite.exec as any) = vi.fn(() => ok({ rows: mockActivities }));
      const logger = createGroupActivityLogger(deps);

      const result = logger.getActivities(createTestGroupId(), 10, 0);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].action).toBe("group_create");
        expect(result.value[1].action).toBe("member_add");
        expect(result.value[1].targetId).toBe("user-789");
      }
    });

    test("uses default limit and offset", () => {
      const deps = createMockDeps();
      (deps.sqlite.exec as any) = vi.fn(() => ok({ rows: [] }));
      const logger = createGroupActivityLogger(deps);

      logger.getActivities(createTestGroupId());

      expect(deps.sqlite.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("limit ?"),
          parameters: expect.arrayContaining(["group-123", 50, 0]),
        })
      );
    });
  });

  describe("getActivitiesByActor", () => {
    test("retrieves activities by actor", () => {
      const deps = createMockDeps();
      const mockActivities = [
        {
          id: "activity-1",
          groupId: "group-123",
          actorId: "user-123",
          action: "group_create",
          targetId: null,
          epochNumber: 1,
          timestamp: "2024-01-01T00:00:00.000Z",
          metadata: null,
        },
      ];

      (deps.sqlite.exec as any) = vi.fn(() => ok({ rows: mockActivities }));
      const logger = createGroupActivityLogger(deps);

      const result = logger.getActivitiesByActor(createTestActorId());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].actorId).toBe("user-123");
      }
    });
  });

  describe("getActivitiesForTarget", () => {
    test("retrieves activities for target user", () => {
      const deps = createMockDeps();
      const mockActivities = [
        {
          id: "activity-1",
          groupId: "group-123",
          actorId: "user-123",
          action: "member_add",
          targetId: "target-123",
          epochNumber: 1,
          timestamp: "2024-01-01T00:00:00.000Z",
          metadata: null,
        },
      ];

      (deps.sqlite.exec as any) = vi.fn(() => ok({ rows: mockActivities }));
      const logger = createGroupActivityLogger(deps);

      const result = logger.getActivitiesForTarget("target-123" as typeof NonEmptyString.Type);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].targetId).toBe("target-123");
      }
    });
  });

  describe("cleanup", () => {
    test("cleans up old activities", () => {
      const deps = createMockDeps();
      (deps.sqlite.exec as any) = vi.fn(() => ok({ changes: 5 }));
      const logger = createGroupActivityLogger(deps);

      const result = logger.cleanup(30);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(5);
      }
      expect(deps.sqlite.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("delete from evolu_group_activity"),
        })
      );
    });

    test("calculates correct cutoff date", () => {
      const deps = createMockDeps();
      const mockNow = new Date("2024-02-01T00:00:00.000Z").getTime();
      (deps.time.now as any) = vi.fn(() => mockNow);
      (deps.sqlite.exec as any) = vi.fn(() => ok({ changes: 0 }));
      
      const logger = createGroupActivityLogger(deps);
      logger.cleanup(7); // 7 days

      // Should delete activities older than 2024-01-25
      expect(deps.sqlite.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("delete from evolu_group_activity"),
          parameters: expect.arrayContaining(["2024-01-25T00:00:00.000Z"]),
        })
      );
    });
  });

  describe("createActivityMetadata", () => {
    test("creates group creation metadata", () => {
      const metadata = createActivityMetadata.groupCreated("My Group");
      
      expect(metadata).toEqual({
        type: "group_created",
        name: "My Group",
      });
    });

    test("creates member addition metadata", () => {
      const metadata = createActivityMetadata.memberAdded("admin");
      
      expect(metadata).toEqual({
        type: "member_added",
        role: "admin",
      });
    });

    test("creates member removal metadata", () => {
      const metadata = createActivityMetadata.memberRemoved("violation");
      
      expect(metadata).toEqual({
        type: "member_removed",
        reason: "violation",
      });
    });

    test("creates role change metadata", () => {
      const metadata = createActivityMetadata.roleChanged("member", "admin");
      
      expect(metadata).toEqual({
        type: "role_changed",
        fromRole: "member",
        toRole: "admin",
      });
    });

    test("creates invite creation metadata", () => {
      const expiresAt = "2024-01-02T00:00:00.000Z";
      const metadata = createActivityMetadata.inviteCreated("member", expiresAt);
      
      expect(metadata).toEqual({
        type: "invite_created",
        role: "member",
        expiresAt,
      });
    });

    test("creates invite usage metadata", () => {
      const metadata = createActivityMetadata.inviteUsed("invite-code-123");
      
      expect(metadata).toEqual({
        type: "invite_used",
        inviteCode: "invite-code-123",
      });
    });

    test("creates invite revocation metadata", () => {
      const metadata = createActivityMetadata.inviteRevoked("invite-code-123", "expired");
      
      expect(metadata).toEqual({
        type: "invite_revoked",
        inviteCode: "invite-code-123",
        reason: "expired",
      });
    });

    test("creates group update metadata", () => {
      const changes = { name: "New Name", description: "New Description" };
      const metadata = createActivityMetadata.groupUpdated(changes);
      
      expect(metadata).toEqual({
        type: "group_updated",
        changes,
      });
    });

    test("creates epoch rotation metadata", () => {
      const metadata = createActivityMetadata.epochRotated(1, 2, "member_removed");
      
      expect(metadata).toEqual({
        type: "epoch_rotated",
        fromEpoch: 1,
        toEpoch: 2,
        reason: "member_removed",
      });
    });
  });
});