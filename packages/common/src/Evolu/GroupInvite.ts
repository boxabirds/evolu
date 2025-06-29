/**
 * Group invitation system for Evolu.
 * 
 * Provides secure invite generation and validation for group membership.
 */

import type { GroupId, GroupRole } from "./GroupSchema.js";
import type { RandomDep } from "../Random.js";
import type { TimeDep } from "../Time.js";
import type { Result } from "../Result.js";
import { ok, err } from "../Result.js";
import type { GroupManager, GroupError } from "./GroupManager.js";
import type { DateIsoString } from "../Type.js";
import type { NanoIdLibDep } from "../NanoId.js";

/**
 * Group invitation data.
 */
export interface GroupInvite {
  readonly groupId: GroupId;
  readonly role: GroupRole;
  readonly createdAt: DateIsoString;
  readonly expiresAt: DateIsoString;
  readonly inviteCode: string;
  readonly createdBy: string;
  readonly maxUses?: number;
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
export interface GroupInviteDeps extends RandomDep, TimeDep, NanoIdLibDep {
  readonly groupManager: GroupManager;
  readonly currentUserId: string;
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
}

/**
 * In-memory storage for invites (for Phase 1).
 * In production, this would be persisted to the database.
 */
const inviteStore = new Map<string, GroupInvite & { uses: number }>();

/**
 * Creates a group invite manager.
 */
export const createGroupInviteManager = (
  deps: GroupInviteDeps
): GroupInviteManager => {
  const generateInviteCode = (): string => {
    // Generate a random 22-character base64url invite code
    return deps.nanoIdLib.nanoid(22);
  };

  const getCurrentTimestamp = (): DateIsoString => {
    return new Date(deps.time.now()).toISOString() as DateIsoString;
  };

  const addHoursToDate = (date: Date, hours: number): Date => {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  };

  return {
    generateInvite: (groupId, role, expiresInHours = 24, maxUses) => {
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
      const createdAt = getCurrentTimestamp();
      const expiresAt = addHoursToDate(now, expiresInHours).toISOString() as DateIsoString;
      const inviteCode = generateInviteCode();

      const invite: GroupInvite = {
        groupId,
        role,
        createdAt,
        expiresAt,
        inviteCode,
        createdBy: deps.currentUserId,
        maxUses,
      };

      // Store invite with usage counter
      inviteStore.set(inviteCode, { ...invite, uses: 0 });

      return ok(invite);
    },

    validateInvite: (inviteCode) => {
      const storedInvite = inviteStore.get(inviteCode);
      
      if (!storedInvite) {
        return {
          valid: false,
          reason: "InvalidInviteFormat",
        };
      }

      const now = deps.time.now();
      const expiresAt = new Date(storedInvite.expiresAt).getTime();

      if (now > expiresAt) {
        return {
          valid: false,
          reason: "InviteExpired",
        };
      }

      if (storedInvite.maxUses && storedInvite.uses >= storedInvite.maxUses) {
        return {
          valid: false,
          reason: "InviteAlreadyUsed",
        };
      }

      return {
        valid: true,
        groupId: storedInvite.groupId,
        role: storedInvite.role,
      };
    },

    acceptInvite: (inviteCode, userId, publicKey) => {
      const storedInvite = inviteStore.get(inviteCode);
      
      if (!storedInvite) {
        return err({ type: "InvalidInviteFormat" });
      }

      const now = deps.time.now();
      const expiresAt = new Date(storedInvite.expiresAt).getTime();

      if (now > expiresAt) {
        return err({ type: "InviteExpired" });
      }

      if (storedInvite.maxUses && storedInvite.uses >= storedInvite.maxUses) {
        return err({ type: "InviteAlreadyUsed" });
      }
      
      // Add member to group
      const result = deps.groupManager.addMember(
        storedInvite.groupId,
        userId,
        storedInvite.role,
        publicKey
      );

      if (result.ok) {
        // Increment usage counter
        storedInvite.uses++;
      }

      return result;
    },
  };
};

/**
 * Clear all invites (for testing).
 */
export const clearInviteStore = (): void => {
  inviteStore.clear();
};