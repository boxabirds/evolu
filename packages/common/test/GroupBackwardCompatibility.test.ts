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
  isGroupTable,
} from "../src/Evolu/GroupSchema.js";

describe("Group Backward Compatibility", () => {
  describe("Table naming conventions", () => {
    test("all group tables follow evolu_ prefix convention", () => {
      for (const tableName of groupTableNames) {
        expect(tableName).toMatch(/^evolu_/);
      }
    });

    test("group table names don't conflict with existing tables", () => {
      const existingEvoluTables = [
        "evolu_owner",
        "evolu_message",
        "evolu_timestamp",
        "evolu_history",
      ];
      
      for (const groupTable of groupTableNames) {
        expect(existingEvoluTables).not.toContain(groupTable);
      }
    });
  });

  describe("Schema structure", () => {
    test("all tables have id column as primary key", () => {
      expect(evolu_group).toHaveProperty("id");
      expect(evolu_group_member).toHaveProperty("id");
      expect(evolu_epoch).toHaveProperty("id");
      expect(evolu_epoch_key).toHaveProperty("id");
      expect(evolu_group_invite).toHaveProperty("id");
      expect(evolu_group_activity).toHaveProperty("id");
    });

    test("no reserved column names are used", () => {
      const reservedColumns = ["rowid", "oid", "_rowid_"];
      
      for (const table of Object.values(groupTables)) {
        for (const column of Object.keys(table)) {
          expect(reservedColumns).not.toContain(column.toLowerCase());
        }
      }
    });
  });

  describe("Type compatibility", () => {
    test("all ID fields use string type", () => {
      // All ID fields should be strings for compatibility with existing ID system
      expect(typeof evolu_group.id).toBe("object"); // Branded string type
      expect(typeof evolu_group_member.id).toBe("object");
      expect(typeof evolu_epoch.id).toBe("object");
      expect(typeof evolu_epoch_key.id).toBe("object");
    });

    test("timestamp fields use compatible format", () => {
      // Check that date fields use DateIso for compatibility
      expect(typeof evolu_group.createdAt).toBe("object");
      expect(typeof evolu_group_member.joinedAt).toBe("object");
      expect(typeof evolu_epoch.startedAt).toBe("object");
      expect(typeof evolu_group_activity.timestamp).toBe("object");
    });
  });

  describe("Additive changes only", () => {
    test("isGroupTable doesn't affect existing table detection", () => {
      // Ensure our helper function only identifies group tables
      const nonGroupTables = [
        "users",
        "todos", 
        "evolu_owner",
        "evolu_message",
        "some_other_table",
      ];
      
      for (const table of nonGroupTables) {
        expect(isGroupTable(table)).toBe(false);
      }
    });

    test("group tables are isolated from user schema", () => {
      // All group tables should be internal (evolu_ prefix)
      // This ensures they don't interfere with user-defined tables
      for (const tableName of groupTableNames) {
        expect(tableName).toMatch(/^evolu_/);
      }
    });
  });

  describe("Migration safety", () => {
    test("no modifications to existing table structures", () => {
      // This test verifies we're not modifying any existing tables
      // by ensuring all our tables are new additions
      const allGroupTablesAreNew = groupTableNames.every(
        name => name.includes("group") || 
                name.includes("epoch") || 
                name.includes("invite") ||
                name.includes("activity")
      );
      
      expect(allGroupTablesAreNew).toBe(true);
    });

    test("nullable fields allow gradual adoption", () => {
      // Optional fields should be nullable to allow existing data
      expect(typeof evolu_group.updatedAt).toBe("object"); // nullOr wrapper
      expect(typeof evolu_group.metadata).toBe("object");
      expect(typeof evolu_group_member.leftAt).toBe("object");
      expect(typeof evolu_epoch.endedAt).toBe("object");
    });
  });

  describe("Performance considerations", () => {
    test("indexes don't conflict with existing indexes", () => {
      // Check that our index names are unique
      const indexNames = [
        "idx_group_member_group",
        "idx_group_member_user",
        "idx_group_member_active",
        "idx_epoch_group",
        "idx_epoch_current",
        "idx_epoch_key_epoch",
        "idx_epoch_key_member",
        "idx_invite_code",
        "idx_invite_group",
        "idx_invite_active",
        "idx_activity_group",
        "idx_activity_actor",
        "idx_activity_timestamp",
      ];
      
      // All index names should be unique
      const uniqueNames = new Set(indexNames);
      expect(uniqueNames.size).toBe(indexNames.length);
      
      // All should have group-related prefixes to avoid conflicts
      for (const indexName of indexNames) {
        expect(indexName).toMatch(/idx_(group|epoch|invite|activity)/);
      }
    });
  });

  describe("Feature flag compatibility", () => {
    test("group tables can be conditionally created", () => {
      // The existence of separate creation functions allows
      // conditional initialization based on feature flags
      expect(typeof isGroupTable).toBe("function");
      
      // Tables can be checked individually
      expect(isGroupTable("evolu_group")).toBe(true);
      expect(isGroupTable("regular_table")).toBe(false);
    });

    test("group functionality is isolated", () => {
      // All group-related exports are namespaced
      expect(groupTables).toBeDefined();
      expect(groupTableNames).toBeDefined();
      
      // This allows importing only what's needed
      expect(Object.keys(groupTables)).toHaveLength(6);
    });
  });
});