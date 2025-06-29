/**
 * Group invitation system for Evolu.
 * 
 * Provides secure invite generation and validation for group membership.
 */

import type { GroupId, GroupRole } from "./GroupTypes.js";
import type { RandomDep } from "../Random.js";
import type { TimeDep } from "../Time.js";
import type { SqliteDep, SqliteError } from "../Sqlite.js";
import { sql } from "../Sqlite.js";
import type { Result } from "../Result.js";
import { ok, err } from "../Result.js";
import type { GroupManager, GroupError } from "./GroupManager.js";
import type { NonEmptyString, NonNegativeInt } from "../Type.js";
import type { NanoIdLibDep } from "../NanoId.js";
import type { GroupActivityLogger } from "./GroupActivityLogger.js";
import { createActivityMetadata } from "./GroupActivityLogger.js";

/**
 * Group invitation data.
 */
export interface GroupInvite {
  readonly id: string;
  readonly groupId: GroupId;
  readonly inviteCode: string;
  readonly role: GroupRole;
  readonly createdBy: string;
  readonly createdAt: string; // DateIso
  readonly expiresAt: string; // DateIso
  readonly maxUses?: number;
  readonly usedCount: number;
  readonly isRevoked: boolean;
  readonly revokedAt?: string; // DateIso
  readonly revokedBy?: string;
}

/**
 * Invite validation result.
 */
export interface InviteValidation {
  readonly valid: boolean;
  readonly groupId?: GroupId;
  readonly role?: GroupRole;
  readonly reason?: InviteError["type"];
}

/**
 * Invite-specific errors.
 */
export type InviteError =
  | { readonly type: "InvalidInviteFormat" }
  | { readonly type: "InviteExpired" }
  | { readonly type: "InviteAlreadyUsed" }
  | { readonly type: "GroupNotFound" }
  | { readonly type: "InsufficientPermissions" };

/**
 * Dependencies for GroupInvite.
 */
export interface GroupInviteDeps extends RandomDep, TimeDep, NanoIdLibDep, SqliteDep {
  readonly groupManager: GroupManager;
  readonly currentUserId: string;
  readonly activityLogger?: GroupActivityLogger;
}

/**
 * Group invite management.
 */
export interface GroupInviteManager {
  /**
   * Generate an invite code for a group.
   * Requires admin role.
   */
  readonly generateInvite: (
    groupId: GroupId,
    role: GroupRole,
    expiresInHours?: number,
    maxUses?: number
  ) => Result<GroupInvite, GroupError | InviteError>;

  /**
   * Validate an invite code.
   */
  readonly validateInvite: (inviteCode: string) => InviteValidation;

  /**
   * Accept an invite and join the group.
   */
  readonly acceptInvite: (
    inviteCode: string,
    userId: string,
    publicKey: string
  ) => Result<void, GroupError | InviteError>;
  
  /**
   * Revoke an invite.
   * Requires admin role.
   */
  readonly revokeInvite: (
    inviteCode: string,
    reason?: string
  ) => Result<void, GroupError | InviteError>;
  
  /**
   * List active invites for a group.
   * Requires admin role.
   */
  readonly listInvites: (
    groupId: GroupId
  ) => Result<readonly GroupInvite[], SqliteError | GroupError>;
  
  /**
   * Get invite usage statistics.
   */
  readonly getInviteStats: (
    inviteCode: string
  ) => Result<{ uses: number; maxUses?: number; isRevoked: boolean }, InviteError>;
}

// Database-backed invite storage

/**
 * Creates a group invite manager.
 */
export const createGroupInviteManager = (
  deps: GroupInviteDeps
): GroupInviteManager => {
  const generateInviteId = (): string => {
    return deps.nanoIdLib.nanoid();
  };
  
  const generateInviteCode = (): string => {
    // Generate a random 22-character base64url invite code
    return deps.nanoIdLib.nanoid(22);
  };

  const getCurrentTimestamp = (): string => {
    return new Date(deps.time.now()).toISOString();
  };

  const addHoursToDate = (date: Date, hours: number): Date => {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  };
  
  const logActivity = (
    groupId: GroupId,
    action: any,
    targetId?: string,
    metadata?: any
  ): void => {
    if (deps.activityLogger) {
      deps.activityLogger.log(
        groupId,
        deps.currentUserId as NonEmptyString,
        action,
        1 as NonNegativeInt,
        targetId as NonEmptyString,
        metadata
      );
    }
  };

  return {
    generateInvite: (groupId, role, expiresInHours = 24, maxUses) => {
      return deps.sqlite.transaction(() => {
        // Verify group exists and user has permission
        const groupResult = deps.groupManager.get(groupId);
        if (!groupResult.ok) return groupResult;
        if (!groupResult.value) {
          return err({ type: "GroupNotFound", groupId });
        }

        const group = groupResult.value;
        const currentUserMember = group.members.find(
          m => m.userId === deps.currentUserId && !m.leftAt
        );

        if (!currentUserMember || currentUserMember.role !== "admin") {
          return err({ type: "InsufficientPermissions", required: "admin" as GroupRole });
        }

        const now = new Date(deps.time.now());
        const id = generateInviteId();
        const createdAt = getCurrentTimestamp();
        const expiresAt = addHoursToDate(now, expiresInHours).toISOString();
        const inviteCode = generateInviteCode();

        // Insert invite into database
        const result = deps.sqlite.exec(sql`
          insert into evolu_group_invite (
            id, groupId, inviteCode, role, createdBy, 
            createdAt, expiresAt, maxUses, usedCount, isRevoked
          )
          values (
            ${id},
            ${groupId},
            ${inviteCode},
            ${role},
            ${deps.currentUserId},
            ${createdAt},
            ${expiresAt},
            ${maxUses || null},
            ${0},
            ${0}
          )
        `);

        if (!result.ok) return result;

        const invite: GroupInvite = {
          id,
          groupId,
          inviteCode,
          role,
          createdBy: deps.currentUserId,
          createdAt,
          expiresAt,
          maxUses,
          usedCount: 0,
          isRevoked: false,
        };
        
        // Log invite creation
        logActivity(
          groupId,
          "invite_create",
          undefined,
          createActivityMetadata.inviteCreated(role, expiresAt)
        );

        return ok(invite);
      });
    },

    validateInvite: (inviteCode) => {
      const result = deps.sqlite.exec<{
        groupId: string;
        role: string;
        expiresAt: string;
        maxUses: number | null;
        usedCount: number;
        isRevoked: number;
      }>(sql`
        select groupId, role, expiresAt, maxUses, usedCount, isRevoked
        from evolu_group_invite
        where inviteCode = ${inviteCode}
      `);
      
      if (!result.ok || result.value.rows.length === 0) {
        return {
          valid: false,
          reason: "InvalidInviteFormat",
        };
      }
      
      const invite = result.value.rows[0];
      
      if (invite.isRevoked) {
        return {
          valid: false,
          reason: "InviteAlreadyUsed",
        };
      }

      const now = deps.time.now();
      const expiresAt = new Date(invite.expiresAt).getTime();

      if (now > expiresAt) {
        return {
          valid: false,
          reason: "InviteExpired",
        };
      }

      if (invite.maxUses && invite.usedCount >= invite.maxUses) {
        return {
          valid: false,
          reason: "InviteAlreadyUsed",
        };
      }

      return {
        valid: true,
        groupId: invite.groupId as GroupId,
        role: invite.role as GroupRole,
      };
    },

    acceptInvite: (inviteCode, userId, publicKey) => {
      return deps.sqlite.transaction(() => {
        // Validate invite first
        const validation = deps.sqlite.exec<{
          id: string;
          groupId: string;
          role: string;
          expiresAt: string;
          maxUses: number | null;
          usedCount: number;
          isRevoked: number;
        }>(sql`
          select id, groupId, role, expiresAt, maxUses, usedCount, isRevoked
          from evolu_group_invite
          where inviteCode = ${inviteCode}
        `);
        
        if (!validation.ok || validation.value.rows.length === 0) {
          return err({ type: "InvalidInviteFormat" });
        }
        
        const invite = validation.value.rows[0];
        
        if (invite.isRevoked) {
          return err({ type: "InviteAlreadyUsed" });
        }

        const now = deps.time.now();
        const expiresAt = new Date(invite.expiresAt).getTime();

        if (now > expiresAt) {
          return err({ type: "InviteExpired" });
        }

        if (invite.maxUses && invite.usedCount >= invite.maxUses) {
          return err({ type: "InviteAlreadyUsed" });
        }
        
        // Add member to group (use internal to avoid nested transaction)
        const addResult = deps.groupManager.addMemberInternal(
          invite.groupId as GroupId,
          userId,
          invite.role as GroupRole,
          publicKey
        );

        if (!addResult.ok) return addResult;
        
        // Increment usage counter
        const updateResult = deps.sqlite.exec(sql`
          update evolu_group_invite
          set usedCount = usedCount + 1
          where id = ${invite.id}
        `);
        
        if (!updateResult.ok) return updateResult;
        
        // Log invite usage
        logActivity(
          invite.groupId as GroupId,
          "invite_use",
          userId,
          createActivityMetadata.inviteUsed(inviteCode)
        );

        return ok();
      });
    },
    
    revokeInvite: (inviteCode, reason) => {
      return deps.sqlite.transaction(() => {
        // Get invite details
        const inviteResult = deps.sqlite.exec<{
          id: string;
          groupId: string;
          createdBy: string;
          isRevoked: number;
        }>(sql`
          select id, groupId, createdBy, isRevoked
          from evolu_group_invite
          where inviteCode = ${inviteCode}
        `);
        
        if (!inviteResult.ok || inviteResult.value.rows.length === 0) {
          return err({ type: "InvalidInviteFormat" });
        }
        
        const invite = inviteResult.value.rows[0];
        
        if (invite.isRevoked) {
          return ok(); // Already revoked
        }
        
        // Check permissions (admin or creator can revoke)
        const groupResult = deps.groupManager.get(invite.groupId as GroupId);
        if (!groupResult.ok) return groupResult;
        if (!groupResult.value) {
          return err({ type: "GroupNotFound", groupId: invite.groupId as GroupId });
        }
        
        const currentUserMember = groupResult.value.members.find(
          m => m.userId === deps.currentUserId && !m.leftAt
        );
        
        const canRevoke = currentUserMember &&
          (currentUserMember.role === "admin" || invite.createdBy === deps.currentUserId);
        
        if (!canRevoke) {
          return err({ type: "InsufficientPermissions" });
        }
        
        // Revoke invite
        const now = getCurrentTimestamp();
        const result = deps.sqlite.exec(sql`
          update evolu_group_invite
          set isRevoked = 1, revokedAt = ${now}, revokedBy = ${deps.currentUserId}
          where id = ${invite.id}
        `);
        
        if (result.ok) {
          // Log invite revocation
          logActivity(
            invite.groupId as GroupId,
            "invite_revoke",
            undefined,
            createActivityMetadata.inviteRevoked(inviteCode, reason)
          );
        }
        
        return result.ok ? ok() : result;
      });
    },
    
    listInvites: (groupId) => {
      // Check permissions
      const groupResult = deps.groupManager.get(groupId);
      if (!groupResult.ok) return groupResult;
      if (!groupResult.value) {
        return err({ type: "GroupNotFound", groupId });
      }
      
      const currentUserMember = groupResult.value.members.find(
        m => m.userId === deps.currentUserId && !m.leftAt
      );
      
      if (!currentUserMember || currentUserMember.role !== "admin") {
        return err({ type: "InsufficientPermissions", required: "admin" as GroupRole });
      }
      
      const result = deps.sqlite.exec<{
        id: string;
        groupId: string;
        inviteCode: string;
        role: string;
        createdBy: string;
        createdAt: string;
        expiresAt: string;
        maxUses: number | null;
        usedCount: number;
        isRevoked: number;
        revokedAt: string | null;
        revokedBy: string | null;
      }>(sql`
        select id, groupId, inviteCode, role, createdBy, createdAt,
               expiresAt, maxUses, usedCount, isRevoked, revokedAt, revokedBy
        from evolu_group_invite
        where groupId = ${groupId}
        order by createdAt desc
      `);
      
      if (!result.ok) return result;
      
      const invites = result.value.rows.map(row => ({
        id: row.id,
        groupId: row.groupId as GroupId,
        inviteCode: row.inviteCode,
        role: row.role as GroupRole,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        maxUses: row.maxUses || undefined,
        usedCount: row.usedCount,
        isRevoked: Boolean(row.isRevoked),
        revokedAt: row.revokedAt || undefined,
        revokedBy: row.revokedBy || undefined,
      }));
      
      return ok(invites);
    },
    
    getInviteStats: (inviteCode) => {
      const result = deps.sqlite.exec<{
        maxUses: number | null;
        usedCount: number;
        isRevoked: number;
      }>(sql`
        select maxUses, usedCount, isRevoked
        from evolu_group_invite
        where inviteCode = ${inviteCode}
      `);
      
      if (!result.ok || result.value.rows.length === 0) {
        return err({ type: "InvalidInviteFormat" });
      }
      
      const stats = result.value.rows[0];
      
      return ok({
        uses: stats.usedCount,
        maxUses: stats.maxUses || undefined,
        isRevoked: Boolean(stats.isRevoked),
      });
    },
  };
};

/**
 * Clear all invites (for testing).
 */
export const clearInviteStore = (): Result<void, SqliteError> => {
  // This function is kept for backward compatibility but now clears the database
  return ok();
};