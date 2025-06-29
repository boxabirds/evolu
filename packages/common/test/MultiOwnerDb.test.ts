import { expect, test, describe } from "vitest";
import { createMultiOwnerTable, createMultiOwnerTableIndexes, tableHasOwnerColumn } from "../src/Evolu/MultiOwnerDb.js";
import { sql } from "../src/Sqlite.js";

describe("MultiOwnerDb", () => {
  test("createMultiOwnerTable includes ownerId column", () => {
    const tableSql = createMultiOwnerTable("todo", ["title", "completed"]);
    
    expect(tableSql).toContain('"id" text primary key');
    expect(tableSql).toContain('"ownerId" blob not null');
    expect(tableSql).toContain('"title" blob');
    expect(tableSql).toContain('"completed" blob');
    expect(tableSql).toContain('"createdAt" blob');
    expect(tableSql).toContain('"updatedAt" blob');
    expect(tableSql).toContain('"isDeleted" blob');
  });

  test("createMultiOwnerTable filters out duplicate columns", () => {
    const tableSql = createMultiOwnerTable("todo", ["title", "createdAt", "ownerId"]);
    
    // Should not have duplicate createdAt (ownerId is explicitly added)
    const createdAtCount = (tableSql.match(/"createdAt"/g) || []).length;
    
    expect(createdAtCount).toBe(1);
    
    // ownerId should appear exactly once
    const ownerIdCount = (tableSql.match(/"ownerId"/g) || []).length;
    expect(ownerIdCount).toBe(1);
  });

  test("createMultiOwnerTableIndexes creates correct indexes", () => {
    const indexes = createMultiOwnerTableIndexes("todo");
    
    expect(indexes).toHaveLength(3);
    
    const indexSqls = indexes.map(idx => idx.sql);
    
    // Check primary owner index
    expect(indexSqls[0]).toContain('create index "idx_todo_owner"');
    expect(indexSqls[0]).toContain('on "todo" ("ownerId")');
    
    // Check composite index
    expect(indexSqls[1]).toContain('create index "idx_todo_owner_updated"');
    expect(indexSqls[1]).toContain('("ownerId", "updatedAt" desc)');
    
    // Check soft delete index
    expect(indexSqls[2]).toContain('create index "idx_todo_owner_deleted"');
    expect(indexSqls[2]).toContain('("ownerId", "isDeleted")');
  });

  test("tableHasOwnerColumn detects ownerId column", () => {
    expect(tableHasOwnerColumn(["id", "title", "ownerId"])).toBe(true);
    expect(tableHasOwnerColumn(["id", "title", "createdAt"])).toBe(false);
    expect(tableHasOwnerColumn([])).toBe(false);
  });
});