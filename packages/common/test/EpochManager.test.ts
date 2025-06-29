import { expect, test, describe } from "vitest";
import {
  InMemoryEpochManager,
  DatabaseEpochManager,
  createEpochManager,
  type EpochMetadata,
} from "../src/Evolu/EpochManager.js";
import { GroupId, EpochId, Epoch } from "../src/Evolu/GroupTypes.js";
import { createIdFromString } from "../src/Type.js";

describe("EpochManager", () => {
  const createTestGroupId = () => 
    createIdFromString<"Group">("test-group-123") as GroupId;

  const createTestEpoch = (epochNumber: number = 1): Epoch => ({
    id: createIdFromString<"Epoch">(`epoch-${epochNumber}`) as EpochId,
    groupId: createTestGroupId(),
    epochNumber,
    startedAt: new Date("2024-01-01"),
    // Don't set optional properties with exactOptionalPropertyTypes
  });

  describe("InMemoryEpochManager", () => {
    test("initializes with default epoch", () => {
      const groupId = createTestGroupId();
      const manager = new InMemoryEpochManager(groupId);
      
      expect(manager.groupId).toBe(groupId);
      expect(manager.currentEpoch.epochNumber).toBe(1);
      expect(manager.currentEpoch.groupId).toBe(groupId);
      expect(manager.currentEpoch.startedAt).toBeInstanceOf(Date);
      expect(manager.currentEpoch.endedAt).toBeUndefined();
      expect(manager.currentEpoch.keyHash).toBeUndefined();
    });

    test("initializes with provided epoch", () => {
      const groupId = createTestGroupId();
      const initialEpoch = createTestEpoch(5);
      const manager = new InMemoryEpochManager(groupId, initialEpoch);
      
      expect(manager.currentEpoch).toBe(initialEpoch);
      expect(manager.currentEpoch.epochNumber).toBe(5);
    });

    test("increments epoch correctly", () => {
      const groupId = createTestGroupId();
      const manager = new InMemoryEpochManager(groupId);
      
      const initialEpoch = manager.currentEpoch;
      expect(initialEpoch.epochNumber).toBe(1);
      
      // Increment epoch
      const newEpoch = manager.incrementEpoch("member_removed", "user123");
      
      expect(newEpoch.epochNumber).toBe(2);
      expect(newEpoch.groupId).toBe(groupId);
      expect(newEpoch.startedAt).toBeInstanceOf(Date);
      expect(newEpoch.endedAt).toBeUndefined();
      
      // Check that previous epoch was ended
      const previousEpoch = manager.getEpoch(1);
      expect(previousEpoch?.endedAt).toBeInstanceOf(Date);
      
      // Current epoch should be updated
      expect(manager.currentEpoch).toBe(newEpoch);
    });

    test("maintains epoch history", () => {
      const groupId = createTestGroupId();
      const manager = new InMemoryEpochManager(groupId);
      
      // Start with epoch 1
      expect(manager.getEpochHistory()).toHaveLength(1);
      
      // Increment to epoch 2
      manager.incrementEpoch("manual", "user1");
      expect(manager.getEpochHistory()).toHaveLength(2);
      
      // Increment to epoch 3
      manager.incrementEpoch("key_rotation", "user2");
      expect(manager.getEpochHistory()).toHaveLength(3);
      
      // Verify history is sorted
      const history = manager.getEpochHistory();
      expect(history[0].epochNumber).toBe(1);
      expect(history[1].epochNumber).toBe(2);
      expect(history[2].epochNumber).toBe(3);
      
      // Verify first two epochs are ended
      expect(history[0].endedAt).toBeInstanceOf(Date);
      expect(history[1].endedAt).toBeInstanceOf(Date);
      expect(history[2].endedAt).toBeUndefined();
    });

    test("validates epoch numbers", () => {
      const groupId = createTestGroupId();
      const manager = new InMemoryEpochManager(groupId);
      
      expect(manager.isValidEpoch(1)).toBe(true);
      expect(manager.isValidEpoch(2)).toBe(false);
      
      manager.incrementEpoch("manual", "user1");
      expect(manager.isValidEpoch(1)).toBe(true);
      expect(manager.isValidEpoch(2)).toBe(true);
      expect(manager.isValidEpoch(3)).toBe(false);
    });

    test("retrieves specific epochs", () => {
      const groupId = createTestGroupId();
      const manager = new InMemoryEpochManager(groupId);
      
      const epoch1 = manager.getEpoch(1);
      expect(epoch1).not.toBeNull();
      expect(epoch1?.epochNumber).toBe(1);
      
      expect(manager.getEpoch(2)).toBeNull();
      
      manager.incrementEpoch("manual", "user1");
      const epoch2 = manager.getEpoch(2);
      expect(epoch2).not.toBeNull();
      expect(epoch2?.epochNumber).toBe(2);
    });

    test("creates deterministic epoch IDs", () => {
      const groupId = createTestGroupId();
      const manager1 = new InMemoryEpochManager(groupId);
      const manager2 = new InMemoryEpochManager(groupId);
      
      // Same group and epoch number should produce same ID
      expect(manager1.currentEpoch.id).toBe(manager2.currentEpoch.id);
      
      // Different epoch numbers should produce different IDs
      const epoch2 = manager1.incrementEpoch("manual", "user1");
      expect(epoch2.id).not.toBe(manager1.getEpoch(1)?.id);
    });

    test("handles multiple increments correctly", () => {
      const groupId = createTestGroupId();
      const manager = new InMemoryEpochManager(groupId);
      
      // Increment multiple times
      for (let i = 0; i < 5; i++) {
        manager.incrementEpoch("manual", `user${i}`);
      }
      
      expect(manager.currentEpoch.epochNumber).toBe(6);
      expect(manager.getEpochHistory()).toHaveLength(6);
      
      // All previous epochs should be ended
      const history = manager.getEpochHistory();
      for (let i = 0; i < 5; i++) {
        expect(history[i].endedAt).toBeInstanceOf(Date);
      }
      expect(history[5].endedAt).toBeUndefined();
    });
  });

  describe("DatabaseEpochManager", () => {
    test("initializes with provided epoch", () => {
      const groupId = createTestGroupId();
      const epoch = createTestEpoch(3);
      const manager = new DatabaseEpochManager(groupId, epoch);
      
      expect(manager.groupId).toBe(groupId);
      expect(manager.currentEpoch).toBe(epoch);
      expect(manager.getCurrentEpoch()).toBe(epoch);
    });

    test("throws on increment in Phase 1", () => {
      const groupId = createTestGroupId();
      const epoch = createTestEpoch();
      const manager = new DatabaseEpochManager(groupId, epoch);
      
      expect(() => {
        manager.incrementEpoch("manual", "user1");
      }).toThrow("DatabaseEpochManager.incrementEpoch not implemented in Phase 1");
    });

    test("returns single epoch in history", () => {
      const groupId = createTestGroupId();
      const epoch = createTestEpoch(5);
      const manager = new DatabaseEpochManager(groupId, epoch);
      
      const history = manager.getEpochHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toBe(epoch);
    });

    test("validates only current epoch", () => {
      const groupId = createTestGroupId();
      const epoch = createTestEpoch(3);
      const manager = new DatabaseEpochManager(groupId, epoch);
      
      expect(manager.isValidEpoch(3)).toBe(true);
      expect(manager.isValidEpoch(1)).toBe(false);
      expect(manager.isValidEpoch(2)).toBe(false);
      expect(manager.isValidEpoch(4)).toBe(false);
    });

    test("retrieves only current epoch", () => {
      const groupId = createTestGroupId();
      const epoch = createTestEpoch(3);
      const manager = new DatabaseEpochManager(groupId, epoch);
      
      expect(manager.getEpoch(3)).toBe(epoch);
      expect(manager.getEpoch(1)).toBeNull();
      expect(manager.getEpoch(2)).toBeNull();
      expect(manager.getEpoch(4)).toBeNull();
    });
  });

  describe("createEpochManager factory", () => {
    test("creates InMemoryEpochManager by default", () => {
      const groupId = createTestGroupId();
      const manager = createEpochManager(groupId);
      
      expect(manager).toBeInstanceOf(InMemoryEpochManager);
      expect(manager.currentEpoch.epochNumber).toBe(1);
    });

    test("creates InMemoryEpochManager with initial epoch", () => {
      const groupId = createTestGroupId();
      const initialEpoch = createTestEpoch(10);
      const manager = createEpochManager(groupId, { initialEpoch });
      
      expect(manager).toBeInstanceOf(InMemoryEpochManager);
      expect(manager.currentEpoch).toBe(initialEpoch);
    });

    test("ignores type option in Phase 1", () => {
      const groupId = createTestGroupId();
      
      // Even if we request database type, we get memory in Phase 1
      const manager = createEpochManager(groupId, { type: "database" });
      expect(manager).toBeInstanceOf(InMemoryEpochManager);
    });
  });

  describe("Epoch metadata handling", () => {
    test("supports all metadata reason types", () => {
      const groupId = createTestGroupId();
      const manager = new InMemoryEpochManager(groupId);
      
      const reasons: EpochMetadata["reason"][] = [
        "member_removed",
        "key_rotation",
        "manual",
      ];
      
      for (const reason of reasons) {
        const epoch = manager.incrementEpoch(reason, "user1");
        expect(epoch).toBeDefined();
        expect(epoch.epochNumber).toBeGreaterThan(1);
      }
    });
  });
});