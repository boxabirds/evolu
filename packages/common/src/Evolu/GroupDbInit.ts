/**
 * Group database initialization for Evolu.
 * 
 * Extends the base database with group-specific tables based on the
 * GroupSchema definitions.
 */

import type { SqliteDep, SqliteError } from "../Sqlite.js";
import { sql } from "../Sqlite.js";
import { ok, Result } from "../Result.js";
import { groupIndexes, groupTableNames } from "./GroupSchema.js";

/**
 * Creates group-related tables in the database.
 * This should be called after the base evolu tables are created.
 */
export const createGroupTables = (
  deps: SqliteDep
): Result<void, SqliteError> => {
  const queries = [
    // Group table
    sql`
      create table if not exists evolu_group (
        "id" text not null primary key,
        "name" text not null,
        "currentEpoch" integer not null,
        "createdAt" text not null,
        "createdBy" text not null,
        "updatedAt" text,
        "metadata" text
      )
      strict;
    `,
    
    // Group member table
    sql`
      create table if not exists evolu_group_member (
        "id" text not null primary key,
        "groupId" text not null,
        "userId" text not null,
        "role" text not null check (role in ('admin', 'member')),
        "publicKey" text not null,
        "joinedAt" text not null,
        "leftAt" text,
        "removedBy" text,
        "epochJoined" integer not null,
        "epochLeft" integer
      )
      strict;
    `,
    
    // Epoch table
    sql`
      create table if not exists evolu_epoch (
        "id" text not null primary key,
        "groupId" text not null,
        "epochNumber" integer not null,
        "startedAt" text not null,
        "endedAt" text,
        "reason" text not null check (reason in ('initial', 'member_removed', 'key_rotation', 'manual')),
        "initiatedBy" text not null,
        "keyHash" text,
        "metadata" text
      )
      strict;
    `,
    
    // Epoch key table (Phase 2 preparation)
    sql`
      create table if not exists evolu_epoch_key (
        "id" text not null primary key,
        "epochId" text not null,
        "memberId" text not null,
        "encryptedKey" text not null,
        "createdAt" text not null
      )
      strict;
    `,
    
    // Group invite table
    sql`
      create table if not exists evolu_group_invite (
        "id" text not null primary key,
        "groupId" text not null,
        "inviteCode" text not null,
        "role" text not null check (role in ('admin', 'member')),
        "createdBy" text not null,
        "createdAt" text not null,
        "expiresAt" text not null,
        "maxUses" integer,
        "usedCount" integer not null default 0,
        "isRevoked" integer not null default 0,
        "revokedAt" text,
        "revokedBy" text
      )
      strict;
    `,
    
    // Group activity log table
    sql`
      create table if not exists evolu_group_activity (
        "id" text not null primary key,
        "groupId" text not null,
        "actorId" text not null,
        "action" text not null check (action in (
          'group_created', 'member_added', 'member_removed', 'member_left',
          'role_changed', 'epoch_rotated', 'invite_created', 'invite_used',
          'invite_revoked', 'group_updated'
        )),
        "targetId" text,
        "epochNumber" integer not null,
        "timestamp" text not null,
        "metadata" text
      )
      strict;
    `,
  ];
  
  // Execute table creation queries
  for (const query of queries) {
    const result = deps.sqlite.exec(query);
    if (!result.ok) return result;
  }
  
  // Create indexes
  for (const indexSql of groupIndexes) {
    // Execute raw SQL string directly
    const result = deps.sqlite.exec({ sql: indexSql, args: [] });
    if (!result.ok) return result;
  }
  
  return ok();
};

/**
 * Checks if all group tables exist in the database
 */
export const groupTablesExist = (
  deps: SqliteDep
): Result<boolean, SqliteError> => {
  const result = deps.sqlite.exec<{ count: number }>(sql`
    select count(*) as count
    from sqlite_master
    where type = 'table' and name in (${groupTableNames.join(", ")});
  `);
  
  if (!result.ok) return result;
  
  const count = result.value.rows[0]?.count || 0;
  return ok(count === groupTableNames.length);
};

/**
 * Drops all group tables (for testing/reset purposes)
 */
export const dropGroupTables = (
  deps: SqliteDep
): Result<void, SqliteError> => {
  // Drop in reverse order to avoid foreign key issues
  const tablesToDrop = [
    "evolu_group_activity",
    "evolu_group_invite",
    "evolu_epoch_key",
    "evolu_epoch",
    "evolu_group_member",
    "evolu_group",
  ];
  
  for (const tableName of tablesToDrop) {
    // Use raw SQL to avoid template literal issues with table names
    const result = deps.sqlite.exec({ 
      sql: `drop table if exists ${tableName};`, 
      args: [] 
    });
    if (!result.ok) return result;
  }
  
  return ok();
};

/**
 * Gets the count of groups in the database
 */
export const getGroupCount = (
  deps: SqliteDep
): Result<number, SqliteError> => {
  const result = deps.sqlite.exec<{ count: number }>(sql`
    select count(*) as count from evolu_group;
  `);
  
  if (!result.ok) return result;
  
  return ok(result.value.rows[0]?.count || 0);
};

/**
 * Verifies group tables have the correct schema
 */
export const verifyGroupSchema = (
  deps: SqliteDep
): Result<boolean, SqliteError> => {
  // Check if tables exist
  const existsResult = groupTablesExist(deps);
  if (!existsResult.ok) return existsResult;
  if (!existsResult.value) return ok(false);
  
  // Verify each table has expected columns
  for (const tableName of groupTableNames) {
    const result = deps.sqlite.exec<{ name: string }>({
      sql: `pragma table_info(${tableName});`,
      args: []
    });
    
    if (!result.ok) return result;
    
    // Just check that we got some columns back
    // More detailed validation could be added here
    if (result.value.rows.length === 0) {
      return ok(false);
    }
  }
  
  return ok(true);
};