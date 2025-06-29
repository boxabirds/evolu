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
 * Creates the owner registry table to support multiple owners
 */
export const createOwnerRegistry = (): SafeSql =>
  sql`
    create table evolu_owner (
      "id" text primary key,
      "type" text not null check(type in ('app', 'group')),
      "mnemonic" text,
      "encryptionKey" blob,
      "createdAt" text not null,
      "writeKey" blob,
      "timestamp" text not null
    )
    strict;
  `.sql;

/**
 * Checks if a table has multi-owner support
 */
export const tableHasOwnerColumn = (
  tableColumns: ReadonlyArray<string>,
): boolean => {
  return tableColumns.includes("ownerId");
};