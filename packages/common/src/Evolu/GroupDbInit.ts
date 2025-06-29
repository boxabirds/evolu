/**
 * Group database initialization for Evolu.
 * Extends the base database with group-specific tables.
 */

import type { SqliteDep, SqliteError } from "../Sqlite.js";
import { sql } from "../Sqlite.js";
import { ok, Result } from "../Result.js";

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
        "role" text not null,
        "publicKey" text not null,
        "joinedAt" text not null,
        "leftAt" text
      )
      strict;
    `,
    
    // Index for group member queries
    sql`
      create index if not exists evolu_group_member_groupId_userId on evolu_group_member (
        "groupId",
        "userId"
      );
    `,
    
    // Unique constraint for group membership
    sql`
      create unique index if not exists evolu_group_member_unique on evolu_group_member (
        "groupId",
        "userId"
      ) where "leftAt" is null;
    `,
    
    // Epoch table
    sql`
      create table if not exists evolu_epoch (
        "id" text not null primary key,
        "groupId" text not null,
        "epochNumber" integer not null,
        "startedAt" text not null,
        "endedAt" text,
        "keyHash" text not null
      )
      strict;
    `,
    
    // Index for epoch queries
    sql`
      create index if not exists evolu_epoch_groupId_epochNumber on evolu_epoch (
        "groupId",
        "epochNumber"
      );
    `,
    
    // Unique constraint for epoch numbers per group
    sql`
      create unique index if not exists evolu_epoch_unique on evolu_epoch (
        "groupId",
        "epochNumber"
      );
    `,
    
    // Epoch key table (for key distribution)
    sql`
      create table if not exists evolu_epoch_key (
        "id" text not null primary key,
        "groupId" text not null,
        "epochNumber" integer not null,
        "memberId" text not null,
        "encryptedKey" text not null,
        "createdAt" text not null
      )
      strict;
    `,
    
    // Index for epoch key queries
    sql`
      create index if not exists evolu_epoch_key_groupId_epochNumber_memberId on evolu_epoch_key (
        "groupId",
        "epochNumber",
        "memberId"
      );
    `,
    
    // Unique constraint for epoch keys per member
    sql`
      create unique index if not exists evolu_epoch_key_unique on evolu_epoch_key (
        "groupId",
        "epochNumber",
        "memberId"
      );
    `,
  ];
  
  // Execute all queries
  for (const query of queries) {
    const result = deps.sqlite.exec(query);
    if (!result.ok) return result;
  }
  
  return ok();
};

/**
 * Checks if group tables exist in the database
 */
export const groupTablesExist = (
  deps: SqliteDep
): Result<boolean, SqliteError> => {
  const result = deps.sqlite.exec(sql`
    select count(*) as count
    from sqlite_master
    where type = 'table' and name in ('evolu_group', 'evolu_group_member', 'evolu_epoch', 'evolu_epoch_key');
  `);
  
  if (!result.ok) return result;
  
  const count = result.value.rows[0]?.count as number;
  return ok(count === 4);
};