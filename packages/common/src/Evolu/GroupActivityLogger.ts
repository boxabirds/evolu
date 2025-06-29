/**
 * Activity logging for group operations.
 * 
 * Provides audit trail functionality for all group-related actions.
 */

import type { SqliteDep, SqliteError } from "../Sqlite.js";
import { sql } from "../Sqlite.js";
import type { Result } from "../Result.js";
import { ok } from "../Result.js";
import type { TimeDep } from "../Time.js";
import type { NanoIdLibDep } from "../NanoId.js";
import type { GroupId } from "./GroupTypes.js";
import type { NonEmptyString, NonNegativeInt } from "../Type.js";
/**
 * Activity action types that match the database schema.
 */
export type GroupActivityAction = 
  | "group_created"
  | "member_added"
  | "member_removed"
  | "member_left"
  | "role_changed"
  | "epoch_rotated"
  | "invite_created"
  | "invite_used"
  | "invite_revoked"
  | "group_updated";

/**
 * Group activity entry.
 */
export interface GroupActivity {
  readonly id: string;
  readonly groupId: GroupId;
  readonly actorId: NonEmptyString;
  readonly action: GroupActivityAction;
  readonly targetId?: NonEmptyString;
  readonly epochNumber: NonNegativeInt;
  readonly timestamp: string; // DateIso
  readonly metadata?: string; // JSON string
}

/**
 * Activity metadata for different operations.
 */
export type ActivityMetadata = 
  | { type: "group_created"; name: string }
  | { type: "member_added"; role: string }
  | { type: "member_removed"; reason?: string }
  | { type: "role_changed"; fromRole: string; toRole: string }
  | { type: "invite_created"; role: string; expiresAt: string }
  | { type: "invite_used"; inviteCode: string }
  | { type: "invite_revoked"; inviteCode: string; reason?: string }
  | { type: "group_updated"; changes: Record<string, unknown> }
  | { type: "epoch_rotated"; fromEpoch: number; toEpoch: number; reason: string };

/**
 * Dependencies for activity logger.
 */
export interface GroupActivityLoggerDeps extends SqliteDep, TimeDep, NanoIdLibDep {}

/**
 * Activity logger interface.
 */
export interface GroupActivityLogger {
  /**
   * Log a group activity.
   */
  readonly log: (
    groupId: GroupId,
    actorId: NonEmptyString,
    action: GroupActivityAction,
    epochNumber: NonNegativeInt,
    targetId?: NonEmptyString,
    metadata?: ActivityMetadata
  ) => Result<void, SqliteError>;

  /**
   * Get activities for a group.
   */
  readonly getActivities: (
    groupId: GroupId,
    limit?: number,
    offset?: number
  ) => Result<readonly GroupActivity[], SqliteError>;

  /**
   * Get activities by actor.
   */
  readonly getActivitiesByActor: (
    actorId: NonEmptyString,
    limit?: number,
    offset?: number
  ) => Result<readonly GroupActivity[], SqliteError>;

  /**
   * Get activities for a specific target user.
   */
  readonly getActivitiesForTarget: (
    targetId: NonEmptyString,
    limit?: number,
    offset?: number
  ) => Result<readonly GroupActivity[], SqliteError>;

  /**
   * Clean up old activities.
   */
  readonly cleanup: (
    olderThanDays: number
  ) => Result<number, SqliteError>;
}

/**
 * Creates a group activity logger.
 */
export const createGroupActivityLogger = (
  deps: GroupActivityLoggerDeps
): GroupActivityLogger => {
  const generateActivityId = (): string => {
    return deps.nanoIdLib.nanoid();
  };

  const getCurrentTimestamp = (): string => {
    return new Date(deps.time.now()).toISOString();
  };

  return {
    log: (groupId, actorId, action, epochNumber, targetId, metadata) => {
      const id = generateActivityId();
      const timestamp = getCurrentTimestamp();
      const metadataJson = metadata ? JSON.stringify(metadata) : null;

      const result = deps.sqlite.exec(sql`
        insert into evolu_group_activity (
          id, groupId, actorId, action, targetId, 
          epochNumber, timestamp, metadata
        )
        values (
          ${id},
          ${groupId},
          ${actorId},
          ${action},
          ${targetId || null},
          ${epochNumber},
          ${timestamp},
          ${metadataJson}
        )
      `);

      return result.ok ? ok() : result;
    },

    getActivities: (groupId, limit = 50, offset = 0) => {
      const result = deps.sqlite.exec<{
        id: string;
        groupId: string;
        actorId: string;
        action: string;
        targetId: string | null;
        epochNumber: number;
        timestamp: string;
        metadata: string | null;
      }>(sql`
        select id, groupId, actorId, action, targetId, 
               epochNumber, timestamp, metadata
        from evolu_group_activity
        where groupId = ${groupId}
        order by timestamp desc
        limit ${limit}
        offset ${offset}
      `);

      if (!result.ok) return result;

      const activities: GroupActivity[] = result.value.rows.map(row => {
        const activity: any = {
          id: row.id,
          groupId: row.groupId as GroupId,
          actorId: row.actorId as NonEmptyString,
          action: row.action as GroupActivityAction,
          epochNumber: row.epochNumber as NonNegativeInt,
          timestamp: row.timestamp,
        };
        if (row.targetId) activity.targetId = row.targetId as NonEmptyString;
        if (row.metadata) activity.metadata = row.metadata;
        return activity as GroupActivity;
      });

      return ok(activities as readonly GroupActivity[]);
    },

    getActivitiesByActor: (actorId, limit = 50, offset = 0) => {
      const result = deps.sqlite.exec<{
        id: string;
        groupId: string;
        actorId: string;
        action: string;
        targetId: string | null;
        epochNumber: number;
        timestamp: string;
        metadata: string | null;
      }>(sql`
        select id, groupId, actorId, action, targetId,
               epochNumber, timestamp, metadata
        from evolu_group_activity
        where actorId = ${actorId}
        order by timestamp desc
        limit ${limit}
        offset ${offset}
      `);

      if (!result.ok) return result;

      const activities: GroupActivity[] = result.value.rows.map(row => {
        const activity: any = {
          id: row.id,
          groupId: row.groupId as GroupId,
          actorId: row.actorId as NonEmptyString,
          action: row.action as GroupActivityAction,
          epochNumber: row.epochNumber as NonNegativeInt,
          timestamp: row.timestamp,
        };
        if (row.targetId) activity.targetId = row.targetId as NonEmptyString;
        if (row.metadata) activity.metadata = row.metadata;
        return activity as GroupActivity;
      });

      return ok(activities as readonly GroupActivity[]);
    },

    getActivitiesForTarget: (targetId, limit = 50, offset = 0) => {
      const result = deps.sqlite.exec<{
        id: string;
        groupId: string;
        actorId: string;
        action: string;
        targetId: string | null;
        epochNumber: number;
        timestamp: string;
        metadata: string | null;
      }>(sql`
        select id, groupId, actorId, action, targetId,
               epochNumber, timestamp, metadata
        from evolu_group_activity
        where targetId = ${targetId}
        order by timestamp desc
        limit ${limit}
        offset ${offset}
      `);

      if (!result.ok) return result;

      const activities: GroupActivity[] = result.value.rows.map(row => {
        const activity: any = {
          id: row.id,
          groupId: row.groupId as GroupId,
          actorId: row.actorId as NonEmptyString,
          action: row.action as GroupActivityAction,
          epochNumber: row.epochNumber as NonNegativeInt,
          timestamp: row.timestamp,
        };
        if (row.targetId) activity.targetId = row.targetId as NonEmptyString;
        if (row.metadata) activity.metadata = row.metadata;
        return activity as GroupActivity;
      });

      return ok(activities as readonly GroupActivity[]);
    },

    cleanup: (olderThanDays) => {
      const cutoffDate = new Date(deps.time.now());
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffTimestamp = cutoffDate.toISOString();

      const result = deps.sqlite.exec<{ changes: number }>(sql`
        delete from evolu_group_activity
        where timestamp < ${cutoffTimestamp}
      `);

      if (!result.ok) return result;

      return ok(result.value.changes || 0);
    },
  };
};

/**
 * Helper to create activity metadata.
 */
export const createActivityMetadata = {
  groupCreated: (name: string): ActivityMetadata => ({
    type: "group_created",
    name,
  }),

  memberAdded: (role: string): ActivityMetadata => ({
    type: "member_added",
    role,
  }),

  memberRemoved: (reason?: string): ActivityMetadata => {
    const metadata: ActivityMetadata = { type: "member_removed" };
    if (reason) metadata.reason = reason;
    return metadata;
  },

  roleChanged: (fromRole: string, toRole: string): ActivityMetadata => ({
    type: "role_changed",
    fromRole,
    toRole,
  }),

  inviteCreated: (role: string, expiresAt: string): ActivityMetadata => ({
    type: "invite_created",
    role,
    expiresAt,
  }),

  inviteUsed: (inviteCode: string): ActivityMetadata => ({
    type: "invite_used",
    inviteCode,
  }),

  inviteRevoked: (inviteCode: string, reason?: string): ActivityMetadata => {
    const metadata: ActivityMetadata = { type: "invite_revoked", inviteCode };
    if (reason) metadata.reason = reason;
    return metadata;
  },

  groupUpdated: (changes: Record<string, unknown>): ActivityMetadata => ({
    type: "group_updated",
    changes,
  }),

  epochRotated: (fromEpoch: number, toEpoch: number, reason: string): ActivityMetadata => ({
    type: "epoch_rotated",
    fromEpoch,
    toEpoch,
    reason,
  }),
};