import { Result, ok, err } from "../Result.js";
import { SqliteDep, SqliteError, sql } from "../Sqlite.js";
import { OwnerId } from "./Owner.js";
import { DbSchema, DbTable } from "./Db.js";
import {
  migrateTableToMultiOwner,
  createMultiOwnerRegistry,
  tableHasOwnerColumn,
} from "./MultiOwnerDb.js";

export interface MultiOwnerMigrationResult {
  readonly migratedTables: ReadonlyArray<string>;
  readonly addedOwnerRegistry: boolean;
}

/**
 * Migrates a database from single-owner to multi-owner support
 * This is a non-breaking change that adds ownerId columns to user tables
 */
export const migrateToMultiOwner = 
  (deps: SqliteDep) =>
  (
    schema: DbSchema,
    appOwnerId: OwnerId,
  ): Result<MultiOwnerMigrationResult, SqliteError> => {
    const migratedTables: Array<string> = [];
    let addedOwnerRegistry = false;

    // Check if we need to create the new owner registry
    const hasOwnerV2 = schema.tables.some((t) => t.name === "evolu_owner_v2");
    
    if (!hasOwnerV2) {
      // Create new multi-owner registry
      const createRegistry = deps.sqlite.exec(createMultiOwnerRegistry());
      if (!createRegistry.ok) return createRegistry;
      
      // Migrate existing owner to new table
      const migrateOwner = deps.sqlite.exec(sql`
        insert into evolu_owner_v2 
          (id, type, mnemonic, encryptionKey, createdAt, writeKey, timestamp, addedAt)
        select 
          id, 
          'app' as type,
          mnemonic,
          encryptionKey,
          createdAt,
          writeKey,
          timestamp,
          createdAt as addedAt
        from evolu_owner
        limit 1;
      `);
      if (!migrateOwner.ok) return migrateOwner;
      
      addedOwnerRegistry = true;
    }

    // Migrate user tables (skip system tables)
    for (const table of schema.tables) {
      if (isUserTable(table.name) && !tableHasOwnerColumn(table.columns)) {
        // Run migration queries
        for (const query of migrateTableToMultiOwner(table.name, appOwnerId)) {
          const result = deps.sqlite.exec(query);
          if (!result.ok) return result;
        }
        migratedTables.push(table.name);
      }
    }

    return ok({ migratedTables, addedOwnerRegistry });
  };

/**
 * Checks if migration to multi-owner is needed
 */
export const needsMultiOwnerMigration = (schema: DbSchema): boolean => {
  // Check if any user table lacks ownerId column
  const hasTablesWithoutOwner = schema.tables.some(
    (table) => isUserTable(table.name) && !tableHasOwnerColumn(table.columns)
  );
  
  // Check if we're still using the old owner table
  const hasOldOwnerTable = schema.tables.some((t) => t.name === "evolu_owner");
  const hasNewOwnerTable = schema.tables.some((t) => t.name === "evolu_owner_v2");
  
  return hasTablesWithoutOwner || (hasOldOwnerTable && !hasNewOwnerTable);
};

/**
 * Determines if a table is a user table (vs system table)
 */
const isUserTable = (tableName: string): boolean => {
  // System tables start with "evolu_" or "_"
  return !tableName.startsWith("evolu_") && !tableName.startsWith("_");
};

/**
 * Gets the current app owner ID from the database
 */
export const getAppOwnerId = 
  (deps: SqliteDep) => 
  (): Result<OwnerId, SqliteError> => {
    // Try new table first
    let result = deps.sqlite.exec<{ id: OwnerId }>(sql`
      select id from evolu_owner_v2 where type = 'app' limit 1;
    `);
    
    if (!result.ok) {
      // Fall back to old table
      result = deps.sqlite.exec<{ id: OwnerId }>(sql`
        select id from evolu_owner limit 1;
      `);
    }
    
    if (!result.ok) return result;
    
    const { rows } = result.value;
    if (rows.length === 0) {
      return err({
        type: "SqliteConstraintError",
        message: "No app owner found",
      } as SqliteError);
    }
    
    return ok(rows[0].id);
  };

/**
 * Lists all owners in the database
 */
export const listOwners = 
  (deps: SqliteDep) => 
  (): Result<ReadonlyArray<{
    id: OwnerId;
    type: "app" | "shared";
    createdAt: string;
    addedAt: string;
  }>, SqliteError> => {
    const result = deps.sqlite.exec<{
      id: OwnerId;
      type: "app" | "shared";
      createdAt: string;
      addedAt: string;
    }>(sql`
      select id, type, createdAt, addedAt 
      from evolu_owner_v2 
      order by addedAt asc;
    `);
    
    if (!result.ok) {
      // If new table doesn't exist, try old table
      const oldResult = deps.sqlite.exec<{
        id: OwnerId;
        createdAt: string;
      }>(sql`
        select id, createdAt from evolu_owner limit 1;
      `);
      
      if (!oldResult.ok) return oldResult;
      
      return ok(oldResult.value.rows.map(row => ({
        id: row.id,
        type: "app" as const,
        createdAt: row.createdAt,
        addedAt: row.createdAt,
      })));
    }
    
    return ok(result.value.rows);
  };