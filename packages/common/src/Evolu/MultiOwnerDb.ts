import { SafeSql, sql } from "../Sqlite.js";
import { OwnerId } from "./Owner.js";

/**
 * Creates a user table with multi-owner support.
 * This extends the existing createAppTable to include an ownerId column.
 */
export const createMultiOwnerTable = (
  tableName: string,
  columns: ReadonlyArray<string>,
): SafeSql => {
  // Get unique columns, filtering out id and ownerId since they're explicit
  const filteredColumns = columns.filter((c) => c !== "id" && c !== "ownerId");
  
  // Add default columns that aren't already present
  const defaultColumns = ["createdAt", "updatedAt", "isDeleted"];
  const allColumns = [...filteredColumns];
  
  for (const defaultCol of defaultColumns) {
    if (!allColumns.includes(defaultCol)) {
      allColumns.push(defaultCol);
    }
  }
  
  return `
    create table ${sql.identifier(tableName).sql} (
      "id" text primary key,
      "ownerId" blob not null,
      ${allColumns
        // "A column with affinity BLOB does not prefer one storage class over another
        // and no attempt is made to coerce data from one storage class into another."
        // https://www.sqlite.org/datatype3.html
        .map((name) => `${sql.identifier(name).sql} blob`)
        .join(", ")}
    );
  ` as SafeSql;
};

/**
 * Creates indexes for multi-owner tables to ensure efficient queries
 */
export const createMultiOwnerTableIndexes = (
  tableName: string,
): ReadonlyArray<SafeSql> => [
  // Primary index for owner-based queries
  sql`
    create index ${sql.identifier(`idx_${tableName}_owner`)} 
    on ${sql.identifier(tableName)} ("ownerId");
  ` as SafeSql,
  
  // Composite index for owner + common query patterns
  sql`
    create index ${sql.identifier(`idx_${tableName}_owner_updated`)} 
    on ${sql.identifier(tableName)} ("ownerId", "updatedAt" desc);
  ` as SafeSql,
  
  // Index for soft deletes
  sql`
    create index ${sql.identifier(`idx_${tableName}_owner_deleted`)} 
    on ${sql.identifier(tableName)} ("ownerId", "isDeleted");
  ` as SafeSql,
];

/**
 * Updates the evolu_owner table to support multiple owners
 * The current schema assumes a single app owner, but we need to support
 * multiple owners (app owner + shared owners)
 */
export const createMultiOwnerRegistry = (): SafeSql =>
  sql`
    create table evolu_owner_v2 (
      "id" text primary key,
      "type" text not null check(type in ('app', 'shared')),
      "mnemonic" text not null,
      "encryptionKey" blob not null,
      "createdAt" text not null,
      "writeKey" blob,
      "timestamp" text not null,
      "addedAt" text not null
    )
    strict;
  ` as SafeSql;

/**
 * Migration function to convert single-owner tables to multi-owner
 * This adds the ownerId column and sets it to the app owner's ID
 */
export const migrateTableToMultiOwner = (
  tableName: string,
  defaultOwnerId: OwnerId,
): ReadonlyArray<SafeSql> => [
  // Add ownerId column as BLOB (to match evolu_history pattern)
  sql`
    alter table ${sql.identifier(tableName)}
    add column "ownerId" blob;
  ` as SafeSql,
  
  // Set default owner for existing rows using ownerIdToBinaryOwnerId conversion
  // For now, we'll cast the text ID to blob for storage
  sql`
    update ${sql.identifier(tableName)}
    set "ownerId" = cast(${defaultOwnerId} as blob)
    where "ownerId" is null;
  ` as SafeSql,
  
  // Create indexes after data is populated
  ...createMultiOwnerTableIndexes(tableName),
];

/**
 * Checks if a table has multi-owner support
 */
export const tableHasOwnerColumn = (
  tableColumns: ReadonlyArray<string>,
): boolean => {
  return tableColumns.includes("ownerId");
};