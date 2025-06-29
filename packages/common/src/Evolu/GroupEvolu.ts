/**
 * Group-aware Evolu implementation.
 * 
 * This module wraps the standard Evolu instance to add group functionality
 * when enableGroups is true in the configuration.
 */

import { ok, err, type Result } from "../Result.js";
import { createStore, type Store } from "../Store.js";
import type { SqliteDep, SqliteError } from "../Sqlite.js";
import type { TimeDep } from "../Time.js";
import type { RandomDep } from "../Random.js";
import type { NanoIdLibDep } from "../NanoId.js";
import type { Evolu } from "./Evolu.js";
import type { EvoluSchema, MutationOptions } from "./Schema.js";
import type { Group, GroupId, GroupRole } from "./GroupSchema.js";
import { createGroupManager, type GroupManager, type GroupError, type GroupWithMembers } from "./GroupManager.js";
import { createGroupInviteManager, type GroupInviteManager, type InviteError } from "./GroupInvite.js";
import type { EvoluWithGroups, GroupContext } from "./GroupAPI.js";
import { hasGroupsEnabled, type GroupConfig } from "./GroupConfig.js";
import type { AppOwner } from "./Owner.js";
import { enhanceMutationOptions, type GroupMutationOptions } from "./GroupMutationExtensions.js";

/**
 * Dependencies for creating a group-aware Evolu instance.
 */
export interface GroupEvoluDeps extends SqliteDep, TimeDep, RandomDep, NanoIdLibDep {
  // Additional dependencies can be added here as needed
}

/**
 * Create a group-aware wrapper around an Evolu instance.
 * 
 * This function takes a standard Evolu instance and extends it with group
 * functionality if enableGroups is true in the configuration.
 */
export const createGroupAwareEvolu = <S extends EvoluSchema>(
  evolu: Evolu<S>,
  config: GroupConfig,
  deps: GroupEvoluDeps
): Evolu<S> | EvoluWithGroups<S> => {
  // If groups are not enabled, return the original evolu instance
  if (!hasGroupsEnabled(config)) {
    return evolu;
  }

  // Create stores for group state
  const currentGroupStore = createStore<GroupContext | null>(null);
  let groupManager: GroupManager | undefined;
  let groupInviteManager: GroupInviteManager | undefined;
  let currentUserId: string | undefined;

  // Subscribe to owner changes to get the current user ID
  const unsubscribeOwner = evolu.subscribeAppOwner(() => {
    const owner = evolu.getAppOwner();
    if (owner) {
      currentUserId = owner.id;
      
      // Initialize group managers when we have a user ID
      if (!groupManager && deps.sqlite) {
        groupManager = createGroupManager({
          ...deps,
          currentUserId: owner.id,
        });
        
        groupInviteManager = createGroupInviteManager({
          ...deps,
          groupManager,
          currentUserId: owner.id,
        });
      }
    }
  });

  // Get initial owner
  const initialOwner = evolu.getAppOwner();
  if (initialOwner) {
    currentUserId = initialOwner.id;
    
    if (deps.sqlite) {
      groupManager = createGroupManager({
        ...deps,
        currentUserId: initialOwner.id,
      });
      
      groupInviteManager = createGroupInviteManager({
        ...deps,
        groupManager,
        currentUserId: initialOwner.id,
      });
    }
  }

  // Wrap mutation methods to support current group context
  const wrapMutation = <T extends (...args: any[]) => any>(
    originalMethod: T
  ): T => {
    return ((...args: any[]) => {
      const [table, props, options] = args;
      
      // Get current group context
      const currentGroup = currentGroupStore.get();
      
      // If there's a current group and no owner specified in options
      if (currentGroup && (!options || !options.owner)) {
        const enhancedOptions: GroupMutationOptions = {
          ...options,
          groupContext: currentGroup,
        };
        
        return originalMethod(
          table,
          props,
          enhanceMutationOptions(enhancedOptions)
        );
      }
      
      // Otherwise use original options
      return originalMethod(table, props, options);
    }) as T;
  };

  // Create the extended evolu instance
  const evoluWithGroups: EvoluWithGroups<S> = {
    ...evolu,
    
    // Wrap mutation methods
    insert: wrapMutation(evolu.insert),
    update: wrapMutation(evolu.update),
    upsert: wrapMutation(evolu.upsert),

    createGroup: async (name: string) => {
      // For now, return a not implemented error
      // TODO: Implement group operations through worker messages
      return err<GroupError>({ 
        type: "GroupNotFound", 
        groupId: "not-implemented" as GroupId 
      });
    },

    joinGroup: async (inviteCode: string) => {
      if (!groupInviteManager || !currentUserId) {
        return err({ type: "InvalidInviteFormat" });
      }
      
      // For Phase 1, use a placeholder public key
      // Phase 2 will generate proper keys
      const publicKey = "placeholder-public-key";
      
      return groupInviteManager.acceptInvite(inviteCode, currentUserId, publicKey);
    },

    leaveGroup: async (groupId: GroupId) => {
      if (!groupManager) {
        return err({ type: "GroupNotFound", groupId });
      }
      return groupManager.leave(groupId);
    },

    getCurrentGroup: () => currentGroupStore.get(),

    setCurrentGroup: (context: GroupContext | null) => {
      currentGroupStore.set(context);
    },

    listGroups: async () => {
      if (!groupManager) {
        return ok([]);
      }
      return groupManager.list();
    },

    subscribeCurrentGroup: currentGroupStore.subscribe,

    getGroup: async (groupId: GroupId) => {
      if (!groupManager) {
        return ok(null);
      }
      return groupManager.get(groupId);
    },

    generateGroupInvite: async (
      groupId: GroupId,
      role: GroupRole,
      expiresInHours?: number,
      maxUses?: number
    ) => {
      if (!groupInviteManager) {
        return err({ type: "GroupNotFound", groupId });
      }
      
      const result = groupInviteManager.generateInvite(groupId, role, expiresInHours, maxUses);
      
      if (result.ok) {
        return ok({ inviteCode: result.value.inviteCode });
      }
      
      return result;
    },

    supportsGroups: true,
    ...(groupManager ? { groupManager } : {}),
    ...(groupInviteManager ? { groupInviteManager } : {}),
  };

  return evoluWithGroups;
};

/**
 * Check if an Evolu instance was created with group support.
 */
export const isGroupAwareEvolu = <S extends EvoluSchema>(
  evolu: Evolu<S>
): evolu is EvoluWithGroups<S> => {
  return 'supportsGroups' in evolu && (evolu as EvoluWithGroups<S>).supportsGroups === true;
};