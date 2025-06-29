/**
 * Group API extensions for Evolu.
 * 
 * This module extends the main Evolu interface with group-related functionality.
 */

import type { Result } from "../Result.js";
import type { SqliteError } from "../Sqlite.js";
import type { Evolu } from "./Evolu.js";
import type { EvoluSchema } from "./Schema.js";
import type { Group, GroupId, GroupRole } from "./GroupSchema.js";
import type { GroupManager, GroupError, GroupWithMembers } from "./GroupManager.js";
import type { GroupInviteManager, InviteError } from "./GroupInvite.js";
import type { StoreSubscribe } from "../Store.js";
import type { Row, Query, QueryRows, QueryRowsMap } from "./Query.js";

/**
 * Current group context for mutations.
 */
export interface GroupContext {
  readonly groupId: GroupId;
  readonly role: GroupRole;
}

/**
 * Extended Evolu interface with group support.
 */
export interface EvoluWithGroups<S extends EvoluSchema = EvoluSchema> extends Evolu<S> {
  /**
   * Create a new group.
   * 
   * Creates a new group with the current user as an admin member.
   * 
   * ### Example
   * 
   * ```ts
   * const result = await evolu.createGroup("My Team");
   * if (result.ok) {
   *   console.log("Created group:", result.value.id);
   * }
   * ```
   */
  readonly createGroup: (name: string) => Promise<Result<GroupWithMembers, SqliteError | GroupError>>;

  /**
   * Join a group using an invite code.
   * 
   * ### Example
   * 
   * ```ts
   * const result = await evolu.joinGroup("invite-code-here");
   * if (result.ok) {
   *   console.log("Joined group successfully");
   * }
   * ```
   */
  readonly joinGroup: (inviteCode: string) => Promise<Result<void, GroupError | InviteError>>;

  /**
   * Leave a group.
   * 
   * You cannot leave a group if you are the last admin.
   * 
   * ### Example
   * 
   * ```ts
   * const result = await evolu.leaveGroup(groupId);
   * if (result.ok) {
   *   console.log("Left group successfully");
   * }
   * ```
   */
  readonly leaveGroup: (groupId: GroupId) => Promise<Result<void, SqliteError | GroupError>>;

  /**
   * Get the current group context.
   * 
   * Returns the currently selected group for mutations, or null if operating
   * in owner context.
   * 
   * ### Example
   * 
   * ```ts
   * const group = evolu.getCurrentGroup();
   * if (group) {
   *   console.log("Current group:", group.id);
   * }
   * ```
   */
  readonly getCurrentGroup: () => GroupContext | null;

  /**
   * Set the current group context.
   * 
   * Sets the active group for subsequent mutations. Pass null to switch
   * back to owner context.
   * 
   * ### Example
   * 
   * ```ts
   * evolu.setCurrentGroup({ groupId, role: "admin" });
   * // All mutations will now be in group context
   * 
   * evolu.setCurrentGroup(null);
   * // Back to owner context
   * ```
   */
  readonly setCurrentGroup: (context: GroupContext | null) => void;

  /**
   * List all groups the current user is a member of.
   * 
   * ### Example
   * 
   * ```ts
   * const result = await evolu.listGroups();
   * if (result.ok) {
   *   console.log("My groups:", result.value);
   * }
   * ```
   */
  readonly listGroups: () => Promise<Result<ReadonlyArray<Group>, SqliteError>>;

  /**
   * Subscribe to current group changes.
   * 
   * ### Example
   * 
   * ```ts
   * const unsubscribe = evolu.subscribeCurrentGroup(() => {
   *   const group = evolu.getCurrentGroup();
   *   console.log("Current group changed:", group);
   * });
   * ```
   */
  readonly subscribeCurrentGroup: StoreSubscribe;

  /**
   * Get a specific group by ID with all details.
   * 
   * ### Example
   * 
   * ```ts
   * const result = await evolu.getGroup(groupId);
   * if (result.ok && result.value) {
   *   console.log("Group:", result.value.name);
   *   console.log("Members:", result.value.members);
   * }
   * ```
   */
  readonly getGroup: (groupId: GroupId) => Promise<Result<GroupWithMembers | null, SqliteError>>;

  /**
   * Generate an invite code for a group.
   * 
   * Requires admin role in the group.
   * 
   * ### Example
   * 
   * ```ts
   * const result = await evolu.generateGroupInvite(groupId, "member", 48, 10);
   * if (result.ok) {
   *   console.log("Invite code:", result.value.inviteCode);
   * }
   * ```
   */
  readonly generateGroupInvite: (
    groupId: GroupId,
    role: GroupRole,
    expiresInHours?: number,
    maxUses?: number
  ) => Promise<Result<{ inviteCode: string }, GroupError | InviteError>>;

  /**
   * Check if groups are supported.
   * 
   * ### Example
   * 
   * ```ts
   * if (evolu.supportsGroups) {
   *   // Group functionality is available
   * }
   * ```
   */
  readonly supportsGroups: boolean;

  /**
   * Get the group manager instance.
   * 
   * For advanced use cases where direct access to the group manager is needed.
   */
  readonly groupManager?: GroupManager;

  /**
   * Get the group invite manager instance.
   * 
   * For advanced use cases where direct access to the invite manager is needed.
   */
  readonly groupInviteManager?: GroupInviteManager;
}

/**
 * Type guard to check if Evolu instance supports groups.
 */
export const hasGroupSupport = <S extends EvoluSchema>(
  evolu: Evolu<S>
): evolu is EvoluWithGroups<S> => {
  return 'supportsGroups' in evolu && (evolu as EvoluWithGroups<S>).supportsGroups === true;
};

/**
 * Context options for mutations.
 */
export interface MutationContextOptions {
  /**
   * The context to use for this mutation. If not specified, uses the
   * current context (either owner or current group).
   */
  readonly context?: GroupContext | "owner";
}