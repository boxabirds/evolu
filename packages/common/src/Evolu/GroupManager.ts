/**
 * Group management functionality for Evolu.
 * 
 * This module provides core operations for creating, managing, and
 * interacting with groups in the Evolu system.
 */

import type { SqliteDep, SqliteError } from "../Sqlite.js";
import { sql } from "../Sqlite.js";
import type { Result } from "../Result.js";
import { ok, err } from "../Result.js";
import type { TimeDep } from "../Time.js";
import type { NanoIdLibDep } from "../NanoId.js";
import type { RandomDep } from "../Random.js";
import { 
  type Group, 
  type GroupId, 
  type GroupRole, 
  type MemberId,
  groupTables 
} from "./GroupSchema.js";
import { DateIsoString, NonNegativeInt, String, minLength, maxLength, NonEmptyString } from "../Type.js";

// Create NonEmptyString50 since it's not exported from Type.js
const NonEmptyString50 = minLength(1)(maxLength(50)(String));
import type { GroupSecurityContext } from "./GroupSecurityContext.js";
import { createGroupSecurityContext } from "./GroupSecurityContext.js";
import type { EpochManager } from "./EpochManager.js";
import { InMemoryEpochManager } from "./EpochManager.js";
import type { GroupAuthProvider } from "./GroupAuthProvider.js";
import { createGroupAuthProvider } from "./GroupAuthProvider.js";
import type { GroupActivityLogger, GroupActivity } from "./GroupActivityLogger.js";
import { createGroupActivityLogger, createActivityMetadata } from "./GroupActivityLogger.js";

/**
 * Group member information.
 */
export interface GroupMember {
  readonly id: MemberId;
  readonly userId: string;
  readonly role: GroupRole;
  readonly publicKey: string;
  readonly joinedAt: DateIsoString;
  readonly leftAt?: DateIsoString;
}

/**
 * Group with members and metadata.
 */
export interface GroupWithMembers extends Group {
  readonly members: ReadonlyArray<GroupMember>;
  readonly epochManager: EpochManager;
  readonly authProvider: GroupAuthProvider;
  readonly securityContext: GroupSecurityContext;
}

/**
 * Dependencies for GroupManager.
 */
export interface GroupManagerDeps extends 
  SqliteDep,
  TimeDep,
  NanoIdLibDep,
  RandomDep {
  readonly currentUserId: string;
  readonly activityLogger?: GroupActivityLogger;
}

/**
 * Group metadata update.
 */
export interface GroupMetadataUpdate {
  readonly name?: string;
  readonly description?: string;
  readonly settings?: Record<string, unknown>;
}

/**
 * Group management operations.
 */
export interface GroupManager {
  /**
   * Create a new group.
   */
  readonly create: (name: string) => Result<GroupWithMembers, SqliteError | GroupError>;
  
  /**
   * Get a group by ID with all members.
   */
  readonly get: (groupId: GroupId) => Result<GroupWithMembers | null, SqliteError>;
  
  /**
   * List all groups the current user is a member of.
   */
  readonly list: () => Result<ReadonlyArray<Group>, SqliteError>;
  
  /**
   * Add a member to a group.
   * Requires admin role.
   */
  readonly addMember: (
    groupId: GroupId, 
    userId: string, 
    role: GroupRole,
    publicKey: string
  ) => Result<void, SqliteError | GroupError>;
  
  /**
   * Add a member to a group (internal, no transaction).
   * Use this when already within a transaction.
   */
  readonly addMemberInternal: (
    groupId: GroupId, 
    userId: string, 
    role: GroupRole,
    publicKey: string
  ) => Result<void, SqliteError | GroupError>;
  
  /**
   * Remove a member from a group.
   * Requires admin role.
   */
  readonly removeMember: (
    groupId: GroupId,
    userId: string
  ) => Result<void, SqliteError | GroupError>;
  
  /**
   * Leave a group.
   * Cannot leave if you're the last admin.
   */
  readonly leave: (groupId: GroupId) => Result<void, SqliteError | GroupError>;
  
  /**
   * Delete a group.
   * Requires admin role and no other members.
   */
  readonly delete: (groupId: GroupId) => Result<void, SqliteError | GroupError>;
  
  /**
   * Update group metadata.
   * Requires admin role.
   */
  readonly updateMetadata: (
    groupId: GroupId,
    updates: GroupMetadataUpdate
  ) => Result<void, SqliteError | GroupError>;
  
  /**
   * Update member role.
   * Requires admin role.
   */
  readonly updateMemberRole: (
    groupId: GroupId,
    userId: string,
    newRole: GroupRole
  ) => Result<void, SqliteError | GroupError>;
  
  /**
   * Get activity log for a group.
   */
  readonly getActivityLog: (
    groupId: GroupId,
    limit?: number,
    offset?: number
  ) => Result<readonly GroupActivity[], SqliteError>;
}

/**
 * Group-specific errors.
 */
export type GroupError = 
  | { readonly type: "GroupNotFound"; readonly groupId: GroupId }
  | { readonly type: "GroupNameTooLong"; readonly name: string }
  | { readonly type: "InsufficientPermissions"; readonly required: GroupRole }
  | { readonly type: "UserAlreadyMember"; readonly userId: string }
  | { readonly type: "UserNotMember"; readonly userId: string }
  | { readonly type: "CannotRemoveLastAdmin" }
  | { readonly type: "GroupNotEmpty" };

/**
 * Creates a group manager instance.
 */
export const createGroupManager = (
  deps: GroupManagerDeps
): GroupManager => {
  const generateGroupId = (): GroupId => {
    return deps.nanoIdLib.nanoid() as GroupId;
  };

  const generateMemberId = (): MemberId => {
    return deps.nanoIdLib.nanoid() as MemberId;
  };

  const getCurrentTimestamp = (): DateIsoString => {
    return new Date(deps.time.now()).toISOString() as DateIsoString;
  };

  const checkUserIsAdmin = (
    groupId: GroupId,
    userId: string
  ): Result<void, SqliteError | GroupError> => {
    const result = deps.sqlite.exec<{ role: string }>(sql`
      select role from evolu_group_member
      where groupId = ${groupId}
        and userId = ${userId}
        and leftAt is null
    `);

    if (!result.ok) return result;
    
    if (result.value.rows.length === 0) {
      return err({ type: "UserNotMember", userId });
    }

    const { role } = result.value.rows[0];
    if (role !== "admin") {
      return err({ type: "InsufficientPermissions", required: "admin" as GroupRole });
    }

    return ok();
  };

  const loadGroupMembers = (
    groupId: GroupId
  ): Result<ReadonlyArray<GroupMember>, SqliteError> => {
    const result = deps.sqlite.exec<{
      id: string;
      userId: string;
      role: string;
      publicKey: string;
      joinedAt: string;
      leftAt: string | null;
    }>(sql`
      select id, userId, role, publicKey, joinedAt, leftAt
      from evolu_group_member
      where groupId = ${groupId}
      order by joinedAt
    `);

    if (!result.ok) return result;

    const members = result.value.rows.map(row => ({
      id: row.id as MemberId,
      userId: row.userId,
      role: row.role as GroupRole,
      publicKey: row.publicKey,
      joinedAt: row.joinedAt as DateIsoString,
      leftAt: row.leftAt ? row.leftAt as DateIsoString : undefined,
    }));

    return ok(members);
  };

  const addMemberInternal = (
    groupId: GroupId,
    userId: string,
    role: GroupRole,
    publicKey: string
  ): Result<void, SqliteError | GroupError> => {
    // Check permissions
    const permCheck = checkUserIsAdmin(groupId, deps.currentUserId);
    if (!permCheck.ok) return permCheck;

    // Check if user already member
    const existingCheck = deps.sqlite.exec<{ count: number }>(sql`
      select count(*) as count
      from evolu_group_member
      where groupId = ${groupId}
        and userId = ${userId}
        and leftAt is null
    `);

    if (!existingCheck.ok) return existingCheck;
    if (existingCheck.value.rows[0].count > 0) {
      return err({ type: "UserAlreadyMember", userId });
    }

    // Add member
    const memberId = generateMemberId();
    const now = getCurrentTimestamp();

    const result = deps.sqlite.exec(sql`
      insert into evolu_group_member (id, groupId, userId, role, publicKey, joinedAt, epochJoined)
      values (
        ${memberId},
        ${groupId},
        ${userId},
        ${role},
        ${publicKey},
        ${now},
        ${1}
      )
    `);

    if (result.ok) {
      // Log member addition
      logActivity(
        groupId,
        "member_added",
        1,
        userId,
        createActivityMetadata.memberAdded(role)
      );
    }
    
    return result.ok ? ok() : result;
  };

  const logActivity = (
    groupId: GroupId,
    action: string,
    epochNumber: number,
    targetId?: string,
    metadata?: any
  ): void => {
    if (deps.activityLogger) {
      deps.activityLogger.log(
        groupId,
        deps.currentUserId as NonEmptyString,
        action as any,
        epochNumber as NonNegativeInt,
        targetId as NonEmptyString,
        metadata
      );
    }
  };

  const createGroupWithMembers = (
    group: Group,
    members: ReadonlyArray<GroupMember>
  ): GroupWithMembers => {
    const activeMembers = members.filter(m => !m.leftAt);
    const epochManager = new InMemoryEpochManager(
      group.id
    );
    
    // Simplified for Phase 1 - AuthProvider and SecurityContext will be added in Phase 2
    const dummyAuthProvider = {} as GroupAuthProvider;
    const dummySecurityContext = {} as GroupSecurityContext;

    return {
      ...group,
      members,
      epochManager,
      authProvider: dummyAuthProvider,
      securityContext: dummySecurityContext,
    };
  };

  return {
    create: (name) => {
      const nameResult = NonEmptyString50.from(name);
      if (!nameResult.ok) {
        return err({ type: "GroupNameTooLong", name });
      }

      const groupId = generateGroupId();
      const memberId = generateMemberId();
      const now = getCurrentTimestamp();

      return deps.sqlite.transaction(() => {
        // Create group
        const createGroupResult = deps.sqlite.exec(sql`
          insert into evolu_group (id, name, currentEpoch, createdAt, createdBy)
          values (
            ${groupId},
            ${nameResult.value},
            ${1},
            ${now},
            ${deps.currentUserId}
          )
        `);

        if (!createGroupResult.ok) return createGroupResult;

        // Add creator as admin
        const addMemberResult = deps.sqlite.exec(sql`
          insert into evolu_group_member (id, groupId, userId, role, publicKey, joinedAt, epochJoined)
          values (
            ${memberId},
            ${groupId},
            ${deps.currentUserId},
            ${"admin"},
            ${"placeholder-public-key"},
            ${now},
            ${1}
          )
        `);

        if (!addMemberResult.ok) return addMemberResult;

        // Create initial epoch
        const epochResult = deps.sqlite.exec(sql`
          insert into evolu_epoch (id, groupId, epochNumber, startedAt, reason, initiatedBy, keyHash)
          values (
            ${deps.nanoIdLib.nanoid()},
            ${groupId},
            ${1},
            ${now},
            ${"initial"},
            ${deps.currentUserId},
            ${"placeholder-hash"}
          )
        `);

        if (!epochResult.ok) return epochResult;

        // Log group creation activity
        if (deps.activityLogger) {
          const logResult = deps.activityLogger.log(
            groupId,
            deps.currentUserId as NonEmptyString,
            "group_created",
            1 as NonNegativeInt,
            undefined,
            createActivityMetadata.groupCreated(nameResult.value)
          );
          if (!logResult.ok) return logResult;
        }

        const group: Group = {
          id: groupId,
          name: nameResult.value,
          currentEpoch: 1 as NonNegativeInt,
          createdAt: now,
          createdBy: deps.currentUserId as NonEmptyString,
          metadata: null,
        };

        const member: GroupMember = {
          id: memberId,
          userId: deps.currentUserId,
          role: "admin" as GroupRole,
          publicKey: "placeholder-public-key",
          joinedAt: now,
        };

        return ok(createGroupWithMembers(group, [member]));
      });
    },

    get: (groupId) => {
      const groupResult = deps.sqlite.exec<{
        id: string;
        name: string;
        currentEpoch: number;
        createdAt: string;
        createdBy: string;
        metadata: string | null;
      }>(sql`
        select id, name, currentEpoch, createdAt, createdBy, metadata
        from evolu_group
        where id = ${groupId}
      `);

      if (!groupResult.ok) return groupResult;
      if (groupResult.value.rows.length === 0) return ok(null);

      const row = groupResult.value.rows[0];
      const membersResult = loadGroupMembers(groupId);
      if (!membersResult.ok) return membersResult;

      const group: Group = {
        id: row.id as GroupId,
        name: row.name as NonEmptyString50,
        currentEpoch: row.currentEpoch as NonNegativeInt,
        createdAt: row.createdAt as DateIsoString,
        createdBy: row.createdBy as NonEmptyString,
        metadata: row.metadata as NonEmptyString | null,
      };

      return ok(createGroupWithMembers(group, membersResult.value));
    },

    list: () => {
      const result = deps.sqlite.exec<{
        id: string;
        name: string;
        currentEpoch: number;
        createdAt: string;
        createdBy: string;
        metadata: string | null;
      }>(sql`
        select g.id, g.name, g.currentEpoch, g.createdAt, g.createdBy, g.metadata
        from evolu_group g
        inner join evolu_group_member m on g.id = m.groupId
        where m.userId = ${deps.currentUserId}
          and m.leftAt is null
        order by g.createdAt desc
      `);

      if (!result.ok) return result;

      const groups = result.value.rows.map(row => ({
        id: row.id as GroupId,
        name: row.name as NonEmptyString50,
        currentEpoch: row.currentEpoch as NonNegativeInt,
        createdAt: row.createdAt as DateIsoString,
        createdBy: row.createdBy as NonEmptyString,
        metadata: row.metadata as NonEmptyString | null,
      }));

      return ok(groups);
    },

    addMember: (groupId, userId, role, publicKey) => {
      return deps.sqlite.transaction(() => {
        return addMemberInternal(groupId, userId, role, publicKey);
      });
    },

    addMemberInternal: addMemberInternal,

    removeMember: (groupId, userId) => {
      return deps.sqlite.transaction(() => {
        // Check permissions
        const permCheck = checkUserIsAdmin(groupId, deps.currentUserId);
        if (!permCheck.ok) return permCheck;

        // Check if removing last admin
        const adminCount = deps.sqlite.exec<{ count: number }>(sql`
          select count(*) as count
          from evolu_group_member
          where groupId = ${groupId}
            and role = 'admin'
            and leftAt is null
        `);

        if (!adminCount.ok) return adminCount;

        const targetRole = deps.sqlite.exec<{ role: string }>(sql`
          select role from evolu_group_member
          where groupId = ${groupId}
            and userId = ${userId}
            and leftAt is null
        `);

        if (!targetRole.ok) return targetRole;
        if (targetRole.value.rows.length === 0) {
          return err({ type: "UserNotMember", userId });
        }

        if (targetRole.value.rows[0].role === "admin" && adminCount.value.rows[0].count === 1) {
          return err({ type: "CannotRemoveLastAdmin" });
        }

        // Mark member as left
        const now = getCurrentTimestamp();
        const result = deps.sqlite.exec(sql`
          update evolu_group_member
          set leftAt = ${now}, removedBy = ${deps.currentUserId}
          where groupId = ${groupId}
            and userId = ${userId}
            and leftAt is null
        `);

        if (result.ok) {
          // Log member removal
          logActivity(
            groupId,
            "member_removed",
            1,
            userId,
            createActivityMetadata.memberRemoved("admin_action")
          );
        }

        return result.ok ? ok() : result;
      });
    },

    leave: (groupId) => {
      return deps.sqlite.transaction(() => {
        // Check if last admin
        const adminCount = deps.sqlite.exec<{ count: number }>(sql`
          select count(*) as count
          from evolu_group_member
          where groupId = ${groupId}
            and role = 'admin'
            and leftAt is null
        `);

        if (!adminCount.ok) return adminCount;

        const userRole = deps.sqlite.exec<{ role: string }>(sql`
          select role from evolu_group_member
          where groupId = ${groupId}
            and userId = ${deps.currentUserId}
            and leftAt is null
        `);

        if (!userRole.ok) return userRole;
        if (userRole.value.rows.length === 0) {
          return err({ type: "UserNotMember", userId: deps.currentUserId });
        }

        if (userRole.value.rows[0].role === "admin" && adminCount.value.rows[0].count === 1) {
          return err({ type: "CannotRemoveLastAdmin" });
        }

        // Mark as left
        const now = getCurrentTimestamp();
        const result = deps.sqlite.exec(sql`
          update evolu_group_member
          set leftAt = ${now}
          where groupId = ${groupId}
            and userId = ${deps.currentUserId}
            and leftAt is null
        `);

        if (result.ok) {
          // Log member leaving
          logActivity(
            groupId,
            "member_left",
            1,
            deps.currentUserId,
            undefined
          );
        }

        return result.ok ? ok() : result;
      });
    },

    delete: (groupId) => {
      return deps.sqlite.transaction(() => {
        // Check permissions
        const permCheck = checkUserIsAdmin(groupId, deps.currentUserId);
        if (!permCheck.ok) return permCheck;

        // Check if group has other members
        const memberCount = deps.sqlite.exec<{ count: number }>(sql`
          select count(*) as count
          from evolu_group_member
          where groupId = ${groupId}
            and leftAt is null
        `);

        if (!memberCount.ok) return memberCount;
        if (memberCount.value.rows[0].count > 1) {
          return err({ type: "GroupNotEmpty" });
        }

        // Delete group and related data in correct order
        // Delete from evolu_group_activity first
        let result = deps.sqlite.exec(sql`
          delete from evolu_group_activity
          where groupId = ${groupId}
        `);
        if (!result.ok) return result;

        // Delete from evolu_group_invite
        result = deps.sqlite.exec(sql`
          delete from evolu_group_invite
          where groupId = ${groupId}
        `);
        if (!result.ok) return result;

        // Delete from evolu_epoch_key
        result = deps.sqlite.exec(sql`
          delete from evolu_epoch_key
          where epochId in (
            select id from evolu_epoch where groupId = ${groupId}
          )
        `);
        if (!result.ok) return result;

        // Delete from evolu_epoch  
        result = deps.sqlite.exec(sql`
          delete from evolu_epoch
          where groupId = ${groupId}
        `);
        if (!result.ok) return result;

        // Delete from evolu_group_member
        result = deps.sqlite.exec(sql`
          delete from evolu_group_member
          where groupId = ${groupId}
        `);
        if (!result.ok) return result;

        // Delete from evolu_group
        result = deps.sqlite.exec(sql`
          delete from evolu_group
          where id = ${groupId}
        `);
        if (!result.ok) return result;

        return ok();
      });
    },

    updateMetadata: (groupId, updates) => {
      return deps.sqlite.transaction(() => {
        // Check permissions
        const permCheck = checkUserIsAdmin(groupId, deps.currentUserId);
        if (!permCheck.ok) return permCheck;

        const now = getCurrentTimestamp();
        let updateFields: string[] = [];
        let updateValues: any[] = [];

        if (updates.name !== undefined) {
          const nameResult = NonEmptyString50.from(updates.name);
          if (!nameResult.ok) {
            return err({ type: "GroupNameTooLong", name: updates.name });
          }
          updateFields.push("name = ?");
          updateValues.push(nameResult.value);
        }

        if (updates.description !== undefined || updates.settings !== undefined) {
          const metadata = {
            description: updates.description,
            settings: updates.settings,
          };
          updateFields.push("metadata = ?");
          updateValues.push(JSON.stringify(metadata));
        }

        updateFields.push("updatedAt = ?");
        updateValues.push(now);

        if (updateFields.length === 1) {
          // Only updatedAt, nothing to update
          return ok();
        }

        const sql_str = `update evolu_group set ${updateFields.join(", ")} where id = ?`;
        updateValues.push(groupId);

        const result = deps.sqlite.exec({
          sql: sql_str as any,
          parameters: updateValues,
        });

        if (result.ok) {
          // Log group update
          logActivity(
            groupId,
            "group_updated",
            1,
            undefined,
            createActivityMetadata.groupUpdated(updates)
          );
        }

        return result.ok ? ok() : result;
      });
    },

    updateMemberRole: (groupId, userId, newRole) => {
      return deps.sqlite.transaction(() => {
        // Check permissions
        const permCheck = checkUserIsAdmin(groupId, deps.currentUserId);
        if (!permCheck.ok) return permCheck;

        // Get current role
        const currentRoleResult = deps.sqlite.exec<{ role: string }>(sql`
          select role from evolu_group_member
          where groupId = ${groupId}
            and userId = ${userId}
            and leftAt is null
        `);

        if (!currentRoleResult.ok) return currentRoleResult;
        if (currentRoleResult.value.rows.length === 0) {
          return err({ type: "UserNotMember", userId });
        }

        const currentRole = currentRoleResult.value.rows[0].role;

        // Check if demoting last admin
        if (currentRole === "admin" && newRole === "member") {
          const adminCount = deps.sqlite.exec<{ count: number }>(sql`
            select count(*) as count
            from evolu_group_member
            where groupId = ${groupId}
              and role = 'admin'
              and leftAt is null
          `);

          if (!adminCount.ok) return adminCount;
          if (adminCount.value.rows[0].count === 1) {
            return err({ type: "CannotRemoveLastAdmin" });
          }
        }

        // Update role
        const result = deps.sqlite.exec(sql`
          update evolu_group_member
          set role = ${newRole}
          where groupId = ${groupId}
            and userId = ${userId}
            and leftAt is null
        `);

        if (result.ok) {
          // Log role change
          logActivity(
            groupId,
            "role_changed",
            1,
            userId,
            createActivityMetadata.roleChanged(currentRole as GroupRole, newRole)
          );
        }

        return result.ok ? ok() : result;
      });
    },

    getActivityLog: (groupId, limit = 50, offset = 0) => {
      if (!deps.activityLogger) {
        return ok([]);
      }

      return deps.activityLogger.getActivities(groupId, limit, offset);
    },
  };
};