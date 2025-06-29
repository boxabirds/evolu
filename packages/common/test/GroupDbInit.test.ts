import { expect, test, describe } from "vitest";
import { createGroupTables, groupTablesExist } from "../src/Evolu/GroupDbInit.js";
import { sql } from "../src/Sqlite.js";
import { testCreateSqliteDriver, testSimpleName } from "./_deps.js";
import { createSqlite } from "../src/Sqlite.js";
import { getOrThrow } from "../src/Result.js";

describe("GroupDbInit", () => {
  const createTestDb = async () => {
    const sqliteResult = await createSqlite({
      createSqliteDriver: testCreateSqliteDriver,
    })(testSimpleName);
    const sqlite = getOrThrow(sqliteResult);
    return { sqlite };
  };
  
  test("creates all group tables", async () => {
    const deps = await createTestDb();
    
    const result = createGroupTables(deps);
    expect(result.ok).toBe(true);
    
    // Verify tables exist
    const tables = deps.sqlite.exec(sql`
      select name from sqlite_master where type = 'table' and name like 'evolu_group%'
      order by name;
    `);
    
    expect(tables.ok).toBe(true);
    if (tables.ok) {
      const tableNames = tables.value.rows.map(row => row.name);
      expect(tableNames).toContain("evolu_group");
      expect(tableNames).toContain("evolu_group_member");
    }
    
    // Check epoch tables
    const epochTables = deps.sqlite.exec(sql`
      select name from sqlite_master where type = 'table' and name like 'evolu_epoch%'
      order by name;
    `);
    
    expect(epochTables.ok).toBe(true);
    if (epochTables.ok) {
      const tableNames = epochTables.value.rows.map(row => row.name);
      expect(tableNames).toContain("evolu_epoch");
      expect(tableNames).toContain("evolu_epoch_key");
    }
  });
  
  test("creates indexes for group tables", async () => {
    const deps = await createTestDb();
    
    const result = createGroupTables(deps);
    expect(result.ok).toBe(true);
    
    // Verify indexes exist
    const indexes = deps.sqlite.exec(sql`
      select name from sqlite_master where type = 'index' and name like 'evolu_group%'
      order by name;
    `);
    
    expect(indexes.ok).toBe(true);
    if (indexes.ok) {
      const indexNames = indexes.value.rows.map(row => row.name);
      expect(indexNames).toContain("evolu_group_member_groupId_userId");
      expect(indexNames).toContain("evolu_group_member_unique");
    }
  });
  
  test("groupTablesExist detects when tables are present", async () => {
    const deps = await createTestDb();
    
    // Check before creation
    const beforeResult = groupTablesExist(deps);
    expect(beforeResult.ok).toBe(true);
    if (beforeResult.ok) {
      expect(beforeResult.value).toBe(false);
    }
    
    // Create tables
    createGroupTables(deps);
    
    // Check after creation
    const afterResult = groupTablesExist(deps);
    expect(afterResult.ok).toBe(true);
    if (afterResult.ok) {
      expect(afterResult.value).toBe(true);
    }
  });
  
  test("handles multiple calls gracefully", async () => {
    const deps = await createTestDb();
    
    // Create tables twice - should not error
    const result1 = createGroupTables(deps);
    expect(result1.ok).toBe(true);
    
    const result2 = createGroupTables(deps);
    expect(result2.ok).toBe(true);
  });
  
  test("can insert into group tables", async () => {
    const deps = await createTestDb();
    
    createGroupTables(deps);
    
    // Test inserting into evolu_group
    const insertGroup = deps.sqlite.exec(sql`
      insert into evolu_group (id, name, currentEpoch, createdAt, createdBy)
      values ('group1', 'Test Group', 1, '2024-01-01T00:00:00Z', 'user1');
    `);
    expect(insertGroup.ok).toBe(true);
    
    // Test inserting into evolu_group_member
    const insertMember = deps.sqlite.exec(sql`
      insert into evolu_group_member (id, groupId, userId, role, publicKey, joinedAt)
      values ('member1', 'group1', 'user1', 'admin', 'publickey1', '2024-01-01T00:00:00Z');
    `);
    expect(insertMember.ok).toBe(true);
    
    // Test inserting into evolu_epoch
    const insertEpoch = deps.sqlite.exec(sql`
      insert into evolu_epoch (id, groupId, epochNumber, startedAt, keyHash)
      values ('epoch1', 'group1', 1, '2024-01-01T00:00:00Z', 'hash1');
    `);
    expect(insertEpoch.ok).toBe(true);
    
    // Test inserting into evolu_epoch_key
    const insertEpochKey = deps.sqlite.exec(sql`
      insert into evolu_epoch_key (id, groupId, epochNumber, memberId, encryptedKey, createdAt)
      values ('key1', 'group1', 1, 'user1', 'encrypted1', '2024-01-01T00:00:00Z');
    `);
    expect(insertEpochKey.ok).toBe(true);
  });
});