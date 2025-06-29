import { expect, test, describe, vi } from "vitest";
import {
  createGroupTables,
  groupTablesExist,
  dropGroupTables,
  getGroupCount,
  verifyGroupSchema,
} from "../src/Evolu/GroupDbInit.js";
import type { SqliteDep, SqliteError, SqliteRow } from "../src/Sqlite.js";
import { ok, err } from "../src/Result.js";

describe("GroupDbInit", () => {
  const createMockSqlite = (
    execResults: Array<{ ok: boolean; error?: SqliteError; rows?: any[] }>
  ): SqliteDep => {
    let callIndex = 0;
    
    return {
      sqlite: {
        exec: vi.fn().mockImplementation(() => {
          const result = execResults[callIndex];
          callIndex++;
          return result.ok ? ok({ rows: result.rows || [] }) : err(result.error!);
        }),
      } as any,
    };
  };

  describe("createGroupTables", () => {
    test("creates all tables and indexes successfully", () => {
      // 6 tables + 13 indexes = 19 successful calls
      const mockResults = Array(19).fill({ ok: true });
      const deps = createMockSqlite(mockResults);
      
      const result = createGroupTables(deps);
      
      expect(result.ok).toBe(true);
      expect(deps.sqlite.exec).toHaveBeenCalledTimes(19);
    });

    test("returns error if table creation fails", () => {
      const mockError: SqliteError = { type: "SqliteError", error: { type: "TransferableError", error: "CREATE_FAILED" } };
      const mockResults = [
        { ok: true }, // First table succeeds
        { ok: false, error: mockError }, // Second table fails
      ];
      const deps = createMockSqlite(mockResults);
      
      const result = createGroupTables(deps);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(mockError);
      }
      expect(deps.sqlite.exec).toHaveBeenCalledTimes(2);
    });

    test("returns error if index creation fails", () => {
      const mockError: SqliteError = { type: "SqliteError", error: { type: "TransferableError", error: "INDEX_FAILED" } };
      const mockResults = [
        ...Array(6).fill({ ok: true }), // All tables succeed
        { ok: false, error: mockError }, // First index fails
      ];
      const deps = createMockSqlite(mockResults);
      
      const result = createGroupTables(deps);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(mockError);
      }
      expect(deps.sqlite.exec).toHaveBeenCalledTimes(7);
    });
  });

  describe("groupTablesExist", () => {
    test("returns true when all tables exist", () => {
      const mockResults = [{ ok: true, rows: [{ count: 6 }] }];
      const deps = createMockSqlite(mockResults);
      
      const result = groupTablesExist(deps);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    test("returns false when not all tables exist", () => {
      const mockResults = [{ ok: true, rows: [{ count: 3 }] }];
      const deps = createMockSqlite(mockResults);
      
      const result = groupTablesExist(deps);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    test("returns false when no tables exist", () => {
      const mockResults = [{ ok: true, rows: [{ count: 0 }] }];
      const deps = createMockSqlite(mockResults);
      
      const result = groupTablesExist(deps);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    test("returns error on query failure", () => {
      const mockError: SqliteError = { type: "SqliteError", error: { type: "TransferableError", error: "QUERY_FAILED" } };
      const mockResults = [{ ok: false, error: mockError }];
      const deps = createMockSqlite(mockResults);
      
      const result = groupTablesExist(deps);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(mockError);
      }
    });
  });

  describe("dropGroupTables", () => {
    test("drops all tables successfully", () => {
      const mockResults = Array(6).fill({ ok: true });
      const deps = createMockSqlite(mockResults);
      
      const result = dropGroupTables(deps);
      
      expect(result.ok).toBe(true);
      expect(deps.sqlite.exec).toHaveBeenCalledTimes(6);
    });

    test("returns error if drop fails", () => {
      const mockError: SqliteError = { type: "SqliteError", error: { type: "TransferableError", error: "DROP_FAILED" } };
      const mockResults = [
        { ok: true }, // First drop succeeds
        { ok: false, error: mockError }, // Second drop fails
      ];
      const deps = createMockSqlite(mockResults);
      
      const result = dropGroupTables(deps);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(mockError);
      }
    });

    test("drops tables in correct order", () => {
      const mockResults = Array(6).fill({ ok: true });
      const deps = createMockSqlite(mockResults);
      
      dropGroupTables(deps);
      
      const calls = (deps.sqlite.exec as any).mock.calls;
      
      // Verify drop order (reverse dependency order)
      expect(calls[0][0].sql).toContain("evolu_group_activity");
      expect(calls[1][0].sql).toContain("evolu_group_invite");
      expect(calls[2][0].sql).toContain("evolu_epoch_key");
      expect(calls[3][0].sql).toContain("evolu_epoch");
      expect(calls[4][0].sql).toContain("evolu_group_member");
      expect(calls[5][0].sql).toContain("evolu_group");
    });
  });

  describe("getGroupCount", () => {
    test("returns group count", () => {
      const mockResults = [{ ok: true, rows: [{ count: 5 }] }];
      const deps = createMockSqlite(mockResults);
      
      const result = getGroupCount(deps);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(5);
      }
    });

    test("returns 0 when no groups", () => {
      const mockResults = [{ ok: true, rows: [{ count: 0 }] }];
      const deps = createMockSqlite(mockResults);
      
      const result = getGroupCount(deps);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(0);
      }
    });

    test("returns 0 when result is empty", () => {
      const mockResults = [{ ok: true, rows: [] }];
      const deps = createMockSqlite(mockResults);
      
      const result = getGroupCount(deps);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(0);
      }
    });

    test("returns error on query failure", () => {
      const mockError: SqliteError = { type: "SqliteError", error: { type: "TransferableError", error: "COUNT_FAILED" } };
      const mockResults = [{ ok: false, error: mockError }];
      const deps = createMockSqlite(mockResults);
      
      const result = getGroupCount(deps);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(mockError);
      }
    });
  });

  describe("verifyGroupSchema", () => {
    test("returns true when schema is valid", () => {
      const mockResults = [
        // groupTablesExist check
        { ok: true, rows: [{ count: 6 }] },
        // pragma table_info for each table (6 tables)
        { ok: true, rows: [{ name: "id" }, { name: "name" }] }, // evolu_group
        { ok: true, rows: [{ name: "id" }, { name: "groupId" }] }, // evolu_group_member
        { ok: true, rows: [{ name: "id" }, { name: "groupId" }] }, // evolu_epoch
        { ok: true, rows: [{ name: "id" }, { name: "epochId" }] }, // evolu_epoch_key
        { ok: true, rows: [{ name: "id" }, { name: "groupId" }] }, // evolu_group_invite
        { ok: true, rows: [{ name: "id" }, { name: "groupId" }] }, // evolu_group_activity
      ];
      const deps = createMockSqlite(mockResults);
      
      const result = verifyGroupSchema(deps);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    test("returns false when tables don't exist", () => {
      const mockResults = [
        // groupTablesExist check returns false
        { ok: true, rows: [{ count: 0 }] },
      ];
      const deps = createMockSqlite(mockResults);
      
      const result = verifyGroupSchema(deps);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    test("returns false when table has no columns", () => {
      const mockResults = [
        // groupTablesExist check
        { ok: true, rows: [{ count: 6 }] },
        // First table has no columns
        { ok: true, rows: [] },
      ];
      const deps = createMockSqlite(mockResults);
      
      const result = verifyGroupSchema(deps);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    test("returns error on query failure", () => {
      const mockError: SqliteError = { type: "SqliteError", error: { type: "TransferableError", error: "SCHEMA_CHECK_FAILED" } };
      const mockResults = [
        // groupTablesExist fails
        { ok: false, error: mockError },
      ];
      const deps = createMockSqlite(mockResults);
      
      const result = verifyGroupSchema(deps);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(mockError);
      }
    });
  });
});