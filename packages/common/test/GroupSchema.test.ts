import { expect, test, describe } from "vitest";
import {
  evolu_group,
  evolu_group_member,
  evolu_epoch,
  evolu_epoch_key,
  evolu_group_invite,
  evolu_group_activity,
  groupTables,
  groupTableNames,
  groupIndexes,
  isGroupTable,
  GroupTable,
} from "../src/Evolu/GroupSchema.js";
import { String, NonEmptyString, NonNegativeInt } from "../src/Type.js";

describe("GroupSchema", () => {
  describe("Table Schemas", () => {
    test("evolu_group has correct schema", () => {
      expect(evolu_group).toHaveProperty("id");
      expect(evolu_group).toHaveProperty("name");
      expect(evolu_group).toHaveProperty("currentEpoch");
      expect(evolu_group).toHaveProperty("createdAt");
      expect(evolu_group).toHaveProperty("createdBy");
      expect(evolu_group).toHaveProperty("updatedAt");
      expect(evolu_group).toHaveProperty("metadata");
      
      // Check that it has the expected number of fields
      expect(Object.keys(evolu_group)).toHaveLength(7);
    });

    test("evolu_group_member has correct schema", () => {
      expect(evolu_group_member).toHaveProperty("id");
      expect(evolu_group_member).toHaveProperty("groupId");
      expect(evolu_group_member).toHaveProperty("userId");
      expect(evolu_group_member).toHaveProperty("role");
      expect(evolu_group_member).toHaveProperty("publicKey");
      expect(evolu_group_member).toHaveProperty("joinedAt");
      expect(evolu_group_member).toHaveProperty("leftAt");
      expect(evolu_group_member).toHaveProperty("removedBy");
      expect(evolu_group_member).toHaveProperty("epochJoined");
      expect(evolu_group_member).toHaveProperty("epochLeft");
      
      expect(Object.keys(evolu_group_member)).toHaveLength(10);
    });

    test("evolu_epoch has correct schema", () => {
      expect(evolu_epoch).toHaveProperty("id");
      expect(evolu_epoch).toHaveProperty("groupId");
      expect(evolu_epoch).toHaveProperty("epochNumber");
      expect(evolu_epoch).toHaveProperty("startedAt");
      expect(evolu_epoch).toHaveProperty("endedAt");
      expect(evolu_epoch).toHaveProperty("reason");
      expect(evolu_epoch).toHaveProperty("initiatedBy");
      expect(evolu_epoch).toHaveProperty("keyHash");
      expect(evolu_epoch).toHaveProperty("metadata");
      
      expect(Object.keys(evolu_epoch)).toHaveLength(9);
    });

    test("evolu_epoch_key has correct schema", () => {
      expect(evolu_epoch_key).toHaveProperty("id");
      expect(evolu_epoch_key).toHaveProperty("epochId");
      expect(evolu_epoch_key).toHaveProperty("memberId");
      expect(evolu_epoch_key).toHaveProperty("encryptedKey");
      expect(evolu_epoch_key).toHaveProperty("createdAt");
      
      expect(Object.keys(evolu_epoch_key)).toHaveLength(5);
    });

    test("evolu_group_invite has correct schema", () => {
      expect(evolu_group_invite).toHaveProperty("id");
      expect(evolu_group_invite).toHaveProperty("groupId");
      expect(evolu_group_invite).toHaveProperty("inviteCode");
      expect(evolu_group_invite).toHaveProperty("role");
      expect(evolu_group_invite).toHaveProperty("createdBy");
      expect(evolu_group_invite).toHaveProperty("createdAt");
      expect(evolu_group_invite).toHaveProperty("expiresAt");
      expect(evolu_group_invite).toHaveProperty("maxUses");
      expect(evolu_group_invite).toHaveProperty("usedCount");
      expect(evolu_group_invite).toHaveProperty("isRevoked");
      expect(evolu_group_invite).toHaveProperty("revokedAt");
      expect(evolu_group_invite).toHaveProperty("revokedBy");
      
      expect(Object.keys(evolu_group_invite)).toHaveLength(12);
    });

    test("evolu_group_activity has correct schema", () => {
      expect(evolu_group_activity).toHaveProperty("id");
      expect(evolu_group_activity).toHaveProperty("groupId");
      expect(evolu_group_activity).toHaveProperty("actorId");
      expect(evolu_group_activity).toHaveProperty("action");
      expect(evolu_group_activity).toHaveProperty("targetId");
      expect(evolu_group_activity).toHaveProperty("epochNumber");
      expect(evolu_group_activity).toHaveProperty("timestamp");
      expect(evolu_group_activity).toHaveProperty("metadata");
      
      expect(Object.keys(evolu_group_activity)).toHaveLength(8);
    });
  });

  describe("groupTables", () => {
    test("contains all group tables", () => {
      expect(groupTables).toHaveProperty("evolu_group");
      expect(groupTables).toHaveProperty("evolu_group_member");
      expect(groupTables).toHaveProperty("evolu_epoch");
      expect(groupTables).toHaveProperty("evolu_epoch_key");
      expect(groupTables).toHaveProperty("evolu_group_invite");
      expect(groupTables).toHaveProperty("evolu_group_activity");
      
      expect(Object.keys(groupTables)).toHaveLength(6);
    });

    test("all tables reference the correct schema", () => {
      expect(groupTables.evolu_group).toBe(evolu_group);
      expect(groupTables.evolu_group_member).toBe(evolu_group_member);
      expect(groupTables.evolu_epoch).toBe(evolu_epoch);
      expect(groupTables.evolu_epoch_key).toBe(evolu_epoch_key);
      expect(groupTables.evolu_group_invite).toBe(evolu_group_invite);
      expect(groupTables.evolu_group_activity).toBe(evolu_group_activity);
    });
  });

  describe("groupTableNames", () => {
    test("contains all table names", () => {
      expect(groupTableNames).toEqual([
        "evolu_group",
        "evolu_group_member",
        "evolu_epoch",
        "evolu_epoch_key",
        "evolu_group_invite",
        "evolu_group_activity",
      ]);
    });

    test("length matches groupTables", () => {
      expect(groupTableNames).toHaveLength(Object.keys(groupTables).length);
    });
  });

  describe("groupIndexes", () => {
    test("contains expected indexes", () => {
      expect(groupIndexes).toHaveLength(13);
      
      // Check for member indexes
      expect(groupIndexes.some(idx => idx.includes("idx_group_member_group"))).toBe(true);
      expect(groupIndexes.some(idx => idx.includes("idx_group_member_user"))).toBe(true);
      expect(groupIndexes.some(idx => idx.includes("idx_group_member_active"))).toBe(true);
      
      // Check for epoch indexes
      expect(groupIndexes.some(idx => idx.includes("idx_epoch_group"))).toBe(true);
      expect(groupIndexes.some(idx => idx.includes("idx_epoch_current"))).toBe(true);
      
      // Check for invite indexes
      expect(groupIndexes.some(idx => idx.includes("idx_invite_code"))).toBe(true);
      expect(groupIndexes.some(idx => idx.includes("idx_invite_group"))).toBe(true);
      expect(groupIndexes.some(idx => idx.includes("idx_invite_active"))).toBe(true);
    });

    test("all indexes are valid SQL", () => {
      for (const index of groupIndexes) {
        expect(index).toMatch(/^CREATE INDEX IF NOT EXISTS/);
        expect(index).toContain(" ON ");
        expect(index).toContain("evolu_");
      }
    });
  });

  describe("isGroupTable", () => {
    test("returns true for group tables", () => {
      expect(isGroupTable("evolu_group")).toBe(true);
      expect(isGroupTable("evolu_group_member")).toBe(true);
      expect(isGroupTable("evolu_epoch")).toBe(true);
      expect(isGroupTable("evolu_epoch_key")).toBe(true);
      expect(isGroupTable("evolu_group_invite")).toBe(true);
      expect(isGroupTable("evolu_group_activity")).toBe(true);
    });

    test("returns false for non-group tables", () => {
      expect(isGroupTable("evolu_owner")).toBe(false);
      expect(isGroupTable("evolu_message")).toBe(false);
      expect(isGroupTable("random_table")).toBe(false);
      expect(isGroupTable("")).toBe(false);
    });
  });

  describe("GroupTable type helper", () => {
    test("extracts correct table types", () => {
      // TypeScript compile-time test
      type GroupTableType = GroupTable<"evolu_group">;
      type ExpectedType = typeof evolu_group;
      
      // This will fail to compile if types don't match
      const _typeTest: ExpectedType extends GroupTableType ? true : false = true;
      expect(_typeTest).toBe(true);
    });
  });

  describe("Schema validation", () => {
    test("all tables use appropriate types", () => {
      // Group table
      expect(evolu_group.currentEpoch).toBe(NonNegativeInt);
      expect(typeof evolu_group.name).toBe("object"); // NonEmptyString1000
      
      // Member table
      expect(evolu_group_member.epochJoined).toBe(NonNegativeInt);
      
      // Epoch table
      expect(evolu_epoch.epochNumber).toBe(NonNegativeInt);
      
      // Invite table
      expect(evolu_group_invite.usedCount).toBe(NonNegativeInt);
      
      // Activity table
      expect(evolu_group_activity.epochNumber).toBe(NonNegativeInt);
    });

    test("nullable fields use nullOr", () => {
      // Check that optional fields are properly wrapped
      expect(typeof evolu_group.updatedAt).toBe("object"); // nullOr
      expect(typeof evolu_group.metadata).toBe("object"); // nullOr
      expect(typeof evolu_group_member.leftAt).toBe("object"); // nullOr
      expect(typeof evolu_epoch.endedAt).toBe("object"); // nullOr
    });
  });

  describe("Schema extensibility", () => {
    test("metadata fields allow JSON storage", () => {
      // Metadata fields should be nullable strings for JSON
      expect(typeof evolu_group.metadata).toBe("object");
      expect(typeof evolu_epoch.metadata).toBe("object");
      expect(typeof evolu_group_activity.metadata).toBe("object");
    });
  });
});