import { expect, test, describe } from "vitest";
import { 
  needsMultiOwnerMigration, 
  migrateToMultiOwner,
  getAppOwnerId,
  listOwners,
} from "../src/Evolu/MultiOwnerMigration.js";
import { DbSchema } from "../src/Evolu/Db.js";
import { testCreateSqlite } from "./_deps.js";
import { sql } from "../src/Sqlite.js";
import { OwnerId } from "../src/Evolu/Owner.js";

describe("MultiOwnerMigration", () => {
  test("needsMultiOwnerMigration detects single-owner schema", () => {
    const singleOwnerSchema: DbSchema = {
      tables: [
        { name: "todo", columns: ["id", "title", "createdAt"] },
        { name: "evolu_owner", columns: ["id", "mnemonic"] },
      ],
      indexes: [],
    };
    
    expect(needsMultiOwnerMigration(singleOwnerSchema)).toBe(true);
  });

  test("needsMultiOwnerMigration detects already migrated schema", () => {
    const multiOwnerSchema: DbSchema = {
      tables: [
        { name: "todo", columns: ["id", "ownerId", "title", "createdAt"] },
        { name: "evolu_owner_v2", columns: ["id", "type", "mnemonic"] },
      ],
      indexes: [],
    };
    
    expect(needsMultiOwnerMigration(multiOwnerSchema)).toBe(false);
  });

  test("needsMultiOwnerMigration handles mixed schema", () => {
    const mixedSchema: DbSchema = {
      tables: [
        { name: "todo", columns: ["id", "title", "createdAt"] }, // needs migration
        { name: "note", columns: ["id", "ownerId", "content"] }, // already migrated
        { name: "evolu_owner", columns: ["id", "mnemonic"] }, // old owner table
      ],
      indexes: [],
    };
    
    expect(needsMultiOwnerMigration(mixedSchema)).toBe(true);
  });

  test("migrateToMultiOwner adds ownerId columns and creates registry", async () => {
    const sqlite = await testCreateSqlite();
    
    // Create initial schema
    sqlite.exec(sql`
      create table todo (
        id text primary key,
        title blob,
        createdAt blob,
        updatedAt blob,
        isDeleted blob
      );
    `);
    
    sqlite.exec(sql`
      create table evolu_owner (
        id text primary key,
        mnemonic text,
        encryptionKey blob,
        createdAt text,
        writeKey blob,
        timestamp text
      );
    `);
    
    sqlite.exec(sql`
      insert into evolu_owner values (
        'owner123',
        'test mnemonic',
        x'deadbeef',
        '2024-01-01T00:00:00Z',
        x'cafebabe',
        '2024-01-01T00:00:00Z'
      );
    `);
    
    // Insert test data
    sqlite.exec(sql`
      insert into todo (id, title, createdAt) values 
        ('todo1', 'Test task', '2024-01-01T00:00:00Z');
    `);
    
    const schema: DbSchema = {
      tables: [
        { name: "todo", columns: ["id", "title", "createdAt", "updatedAt", "isDeleted"] },
        { name: "evolu_owner", columns: ["id", "mnemonic", "encryptionKey", "createdAt", "writeKey", "timestamp"] },
      ],
      indexes: [],
    };
    
    const result = migrateToMultiOwner({ sqlite })(schema, "owner123" as OwnerId);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(result.value.migratedTables).toContain("todo");
      expect(result.value.addedOwnerRegistry).toBe(true);
    }
    
    // Verify ownerId was added by checking the CREATE statement
    const todoInfo = sqlite.exec(sql`
      select sql from sqlite_master where name = 'todo';
    `);
    
    if (todoInfo.ok && todoInfo.value.rows.length > 0) {
      const createSql = todoInfo.value.rows[0].sql;
      expect(createSql).toContain('"ownerId" blob');
    }
    
    // Verify existing data got default owner
    const todoData = sqlite.exec(sql`select id, ownerId from todo;`);
    expect(todoData.ok).toBe(true);
    
    if (todoData.ok) {
      expect(todoData.value.rows).toHaveLength(1);
      const row = todoData.value.rows[0] as any;
      expect(row.id).toBe("todo1");
      // ownerId is stored as BLOB, so it should be a Buffer/Uint8Array
      expect(row.ownerId).toBeDefined();
      // Convert back to string to verify it's the correct owner
      const ownerIdString = Buffer.from(row.ownerId.data || row.ownerId).toString('utf8');
      expect(ownerIdString).toBe("owner123");
    }
    
    // Verify new owner registry exists
    const ownerRegistry = sqlite.exec(sql`select * from evolu_owner_v2;`);
    expect(ownerRegistry.ok).toBe(true);
    
    if (ownerRegistry.ok) {
      expect(ownerRegistry.value.rows).toHaveLength(1);
      expect(ownerRegistry.value.rows[0]).toMatchObject({
        id: "owner123",
        type: "app",
        mnemonic: "test mnemonic",
      });
    }
  });

  test("getAppOwnerId retrieves from new table first", async () => {
    const sqlite = await testCreateSqlite();
    
    // Create new owner registry
    sqlite.exec(sql`
      create table evolu_owner_v2 (
        id blob primary key,
        type text,
        mnemonic text,
        encryptionKey blob,
        createdAt text,
        writeKey blob,
        timestamp text,
        addedAt text
      );
    `);
    
    sqlite.exec(sql`
      insert into evolu_owner_v2 (id, type, mnemonic, encryptionKey, createdAt, writeKey, timestamp, addedAt)
      values ('owner456', 'app', 'test', x'dead', '2024-01-01', x'beef', '2024-01-01', '2024-01-01');
    `);
    
    const result = getAppOwnerId({ sqlite })();
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(result.value).toBe("owner456");
    }
  });

  test("listOwners returns all owners", async () => {
    const sqlite = await testCreateSqlite();
    
    sqlite.exec(sql`
      create table evolu_owner_v2 (
        id blob primary key,
        type text,
        createdAt text,
        addedAt text
      );
    `);
    
    sqlite.exec(sql`
      insert into evolu_owner_v2 (id, type, createdAt, addedAt) values 
        ('app_owner', 'app', '2024-01-01', '2024-01-01'),
        ('shared_owner', 'shared', '2024-01-02', '2024-01-02');
    `);
    
    const result = listOwners({ sqlite })();
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]).toMatchObject({
        id: "app_owner",
        type: "app",
      });
      expect(result.value[1]).toMatchObject({
        id: "shared_owner", 
        type: "shared",
      });
    }
  });
});