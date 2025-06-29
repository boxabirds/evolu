/**
 * Group-related database schema definitions for Evolu.
 * These tables support multi-user groups with epoch-based key management.
 */

import { id, type InferType } from "../Type.js";
import { SqliteBoolean } from "../Sqlite.js";
import { NonEmptyString, NonEmptyString50, nullOr, DateIsoString, NonNegativeInt } from "../Type.js";
import type { OwnerId } from "./Owner.js";

// Group ID type
export const GroupId = id("evolu_group");
export type GroupId = InferType<typeof GroupId>;

// Member ID (references Owner ID)
export const MemberId = id("evolu_group_member");
export type MemberId = InferType<typeof MemberId>;

// Epoch ID
export const EpochId = id("evolu_epoch");
export type EpochId = InferType<typeof EpochId>;

// Epoch Key ID
export const EpochKeyId = id("evolu_epoch_key");
export type EpochKeyId = InferType<typeof EpochKeyId>;

// Role type - using string for now, can be made more specific later
export const GroupRole = NonEmptyString;
export type GroupRole = InferType<typeof GroupRole>;

/**
 * Group tables to be added to the Evolu schema.
 * These are internal tables that support group functionality.
 */
export const groupTables = {
  evolu_group: {
    id: GroupId,
    name: NonEmptyString50,
    currentEpoch: NonNegativeInt,
    createdAt: DateIsoString,
    createdBy: NonEmptyString, // OwnerId as string
    metadata: nullOr(NonEmptyString), // JSON string for extensibility
  },
  
  evolu_group_member: {
    id: MemberId,
    groupId: NonEmptyString, // GroupId as string
    userId: NonEmptyString, // OwnerId as string
    role: GroupRole, // 'admin' | 'member'
    publicKey: NonEmptyString, // Base64 encoded public key
    joinedAt: DateIsoString,
    leftAt: nullOr(DateIsoString),
  },
  
  evolu_epoch: {
    id: EpochId,
    groupId: NonEmptyString, // GroupId as string
    epochNumber: NonNegativeInt,
    startedAt: DateIsoString,
    endedAt: nullOr(DateIsoString),
    keyHash: NonEmptyString, // Base64 encoded hash for verification
  },
  
  evolu_epoch_key: {
    id: EpochKeyId,
    groupId: NonEmptyString, // GroupId as string
    epochNumber: NonNegativeInt,
    memberId: NonEmptyString, // OwnerId as string
    encryptedKey: NonEmptyString, // Base64 encoded encrypted key
    createdAt: DateIsoString,
  },
} as const;

/**
 * Type guard to check if a table name is a group table
 */
export const isGroupTable = (tableName: string): boolean => {
  return tableName in groupTables;
};

/**
 * Get all group table names
 */
export const getGroupTableNames = (): ReadonlyArray<string> => {
  return Object.keys(groupTables);
};