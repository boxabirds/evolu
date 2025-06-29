/**
 * Group-related database schema definitions for Evolu.
 * 
 * These tables extend Evolu's internal schema to support multi-user groups
 * with epoch-based versioning and membership management.
 */

import { 
  NonEmptyString, 
  NonEmptyString1000,
  String,
  NonNegativeInt,
  DateIso,
  nullOr,
  literal,
  union,
  Boolean,
} from "../Type.js";
import { SqliteBoolean } from "../Sqlite.js";
import type { 
  GroupId,
  MemberId,
  EpochId,
  EpochKeyId,
  GroupRole,
} from "./GroupTypes.js";
import type { GroupActivityAction } from "./GroupActivityLogger.js";

// Re-export group types
export type { 
  GroupId,
  MemberId,
  EpochId,
  EpochKeyId,
  GroupRole,
  Group,
} from "./GroupTypes.js";

/**
 * Group table schema.
 * Stores group metadata and current epoch information.
 */
export const evolu_group = {
  id: String as unknown as typeof String & { _type: GroupId },
  name: NonEmptyString1000,
  currentEpoch: NonNegativeInt,
  createdAt: DateIso,
  createdBy: NonEmptyString, // User ID who created the group
  updatedAt: nullOr(DateIso),
  metadata: nullOr(String), // JSON string for extensibility
} as const;

/**
 * Group member table schema.
 * Tracks membership, roles, and public keys for group members.
 */
export const evolu_group_member = {
  id: String as unknown as typeof String & { _type: MemberId },
  groupId: String as unknown as typeof String & { _type: GroupId },
  userId: NonEmptyString, // The user's ID
  role: union(literal("admin"), literal("member")) as unknown as typeof String & { _type: GroupRole },
  publicKey: NonEmptyString, // Base64 encoded public key
  joinedAt: DateIso,
  leftAt: nullOr(DateIso),
  removedBy: nullOr(NonEmptyString), // User ID who removed this member
  epochJoined: NonNegativeInt, // Epoch when member joined
  epochLeft: nullOr(NonNegativeInt), // Epoch when member left
} as const;

/**
 * Epoch table schema.
 * Tracks epoch history for each group.
 */
export const evolu_epoch = {
  id: String as unknown as typeof String & { _type: EpochId },
  groupId: String as unknown as typeof String & { _type: GroupId },
  epochNumber: NonNegativeInt,
  startedAt: DateIso,
  endedAt: nullOr(DateIso),
  reason: union(
    literal("initial"),
    literal("member_removed"),
    literal("key_rotation"),
    literal("manual"),
  ),
  initiatedBy: NonEmptyString, // User ID who initiated the epoch change
  keyHash: nullOr(NonEmptyString), // Hash of the epoch key (Phase 2)
  metadata: nullOr(String), // JSON string for additional data
} as const;

/**
 * Epoch key table schema (Phase 2 preparation).
 * Will store encrypted epoch keys for group members.
 */
export const evolu_epoch_key = {
  id: String as unknown as typeof String & { _type: EpochKeyId },
  epochId: String as unknown as typeof String & { _type: EpochId },
  memberId: String as unknown as typeof String & { _type: MemberId },
  encryptedKey: NonEmptyString, // Encrypted with member's public key
  createdAt: DateIso,
  // Phase 2: Additional fields for key management
} as const;

/**
 * Group invite table schema.
 * Stores invite codes and their usage.
 */
export const evolu_group_invite = {
  id: NonEmptyString, // Unique invite ID
  groupId: String as unknown as typeof String & { _type: GroupId },
  inviteCode: NonEmptyString, // The shareable invite code
  role: union(literal("admin"), literal("member")) as unknown as typeof String & { _type: GroupRole },
  createdBy: NonEmptyString, // User ID who created the invite
  createdAt: DateIso,
  expiresAt: DateIso,
  maxUses: nullOr(NonNegativeInt), // null = unlimited
  usedCount: NonNegativeInt,
  isRevoked: SqliteBoolean,
  revokedAt: nullOr(DateIso),
  revokedBy: nullOr(NonEmptyString),
} as const;

/**
 * Group activity log table schema.
 * Tracks important group events for audit purposes.
 */
export const evolu_group_activity = {
  id: NonEmptyString,
  groupId: String as unknown as typeof String & { _type: GroupId },
  actorId: NonEmptyString, // User ID who performed the action
  action: union(
    literal("group_created"),
    literal("member_added"),
    literal("member_removed"),
    literal("member_left"),
    literal("role_changed"),
    literal("epoch_rotated"),
    literal("invite_created"),
    literal("invite_used"),
    literal("invite_revoked"),
    literal("group_updated")
  ) as unknown as typeof String & { _type: GroupActivityAction },
  targetId: nullOr(NonEmptyString), // Target user ID (if applicable)
  epochNumber: NonNegativeInt, // Epoch when action occurred
  timestamp: DateIso,
  metadata: nullOr(String), // JSON string with additional details
} as const;

/**
 * All group-related tables to be added to Evolu's internal schema.
 */
export const groupTables = {
  evolu_group,
  evolu_group_member,
  evolu_epoch,
  evolu_epoch_key,
  evolu_group_invite,
  evolu_group_activity,
} as const;

/**
 * Group table names for easy reference.
 */
export const groupTableNames = Object.keys(groupTables) as (keyof typeof groupTables)[];

/**
 * Indexes to optimize group queries.
 * These will be created when group tables are initialized.
 */
export const groupIndexes = [
  // Group member queries
  "CREATE INDEX IF NOT EXISTS idx_group_member_group ON evolu_group_member(groupId)",
  "CREATE INDEX IF NOT EXISTS idx_group_member_user ON evolu_group_member(userId)",
  "CREATE INDEX IF NOT EXISTS idx_group_member_active ON evolu_group_member(groupId, leftAt) WHERE leftAt IS NULL",
  
  // Epoch queries
  "CREATE INDEX IF NOT EXISTS idx_epoch_group ON evolu_epoch(groupId)",
  "CREATE INDEX IF NOT EXISTS idx_epoch_current ON evolu_epoch(groupId, epochNumber)",
  
  // Epoch key queries (Phase 2)
  "CREATE INDEX IF NOT EXISTS idx_epoch_key_epoch ON evolu_epoch_key(epochId)",
  "CREATE INDEX IF NOT EXISTS idx_epoch_key_member ON evolu_epoch_key(memberId)",
  
  // Invite queries
  "CREATE INDEX IF NOT EXISTS idx_invite_code ON evolu_group_invite(inviteCode)",
  "CREATE INDEX IF NOT EXISTS idx_invite_group ON evolu_group_invite(groupId)",
  "CREATE INDEX IF NOT EXISTS idx_invite_active ON evolu_group_invite(inviteCode, expiresAt, isRevoked) WHERE isRevoked = 0",
  
  // Activity log queries
  "CREATE INDEX IF NOT EXISTS idx_activity_group ON evolu_group_activity(groupId)",
  "CREATE INDEX IF NOT EXISTS idx_activity_actor ON evolu_group_activity(actorId)",
  "CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON evolu_group_activity(groupId, timestamp DESC)",
] as const;

/**
 * Type helper to extract the table type from the schema.
 */
export type GroupTable<T extends keyof typeof groupTables> = typeof groupTables[T];

/**
 * Helper to check if a table name is a group table.
 */
export function isGroupTable(tableName: string): tableName is keyof typeof groupTables {
  return tableName in groupTables;
}

/**
 * Helper to get all group table creation SQL.
 * This is used during database initialization.
 */
export function getGroupTableSQL(): string[] {
  const tables: string[] = [];
  
  // Note: Actual SQL generation would be done by the Kysely schema builder
  // This is just a placeholder to show the structure
  
  return tables;
}