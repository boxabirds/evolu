/**
 * Group mutation extensions for Evolu.
 * 
 * This module extends mutations to work with group contexts by leveraging
 * the existing SharedOwner infrastructure.
 */

import type { MutationOptions } from "./Schema.js";
import type { GroupContext } from "./GroupAPI.js";
import type { SharedOwner } from "./Owner.js";
import type { GroupId } from "./GroupSchema.js";

/**
 * Extended mutation options that support group context.
 */
export interface GroupMutationOptions extends MutationOptions {
  /**
   * The group context to use for this mutation. If specified, the mutation
   * will be performed in the context of the group, creating a SharedOwner
   * internally.
   * 
   * If both `groupContext` and `owner` are specified, `owner` takes precedence.
   */
  readonly groupContext?: GroupContext;
}

/**
 * Convert a group context to a SharedOwner.
 * 
 * In Phase 1, this creates a placeholder SharedOwner. Phase 2 will
 * implement proper key derivation and encryption.
 */
export const groupContextToSharedOwner = (
  context: GroupContext
): SharedOwner => {
  // Phase 1: Create a placeholder SharedOwner
  // The ID format matches what SharedOwner expects
  const sharedOwnerId = `group:${context.groupId}` as SharedOwner["id"];
  
  // Phase 1: Use placeholder keys
  // Phase 2 will derive these from group epoch keys
  const encryptionKey = new Uint8Array(32); // Placeholder
  const writeKey = new Uint8Array(16); // Placeholder
  
  return {
    id: sharedOwnerId,
    encryptionKey,
    writeKey,
  };
};

/**
 * Enhance mutation options with group context support.
 * 
 * If a groupContext is provided and no owner is specified, this creates
 * a SharedOwner from the group context.
 */
export const enhanceMutationOptions = (
  options?: GroupMutationOptions
): MutationOptions | undefined => {
  if (!options) return options;
  
  const { groupContext, ...baseOptions } = options;
  
  // If owner is already specified, return original options
  if (options.owner) {
    return options;
  }
  
  // If groupContext is provided, convert to SharedOwner
  if (groupContext) {
    return {
      ...baseOptions,
      owner: groupContextToSharedOwner(groupContext),
    };
  }
  
  // Otherwise return options unchanged
  return options;
};

/**
 * Check if a SharedOwner represents a group context.
 */
export const isGroupSharedOwner = (owner: SharedOwner): boolean => {
  return owner.id.startsWith("group:");
};

/**
 * Extract GroupId from a group SharedOwner.
 */
export const extractGroupIdFromSharedOwner = (
  owner: SharedOwner
): GroupId | null => {
  if (!isGroupSharedOwner(owner)) return null;
  
  // Remove "group:" prefix
  const groupId = owner.id.substring(6);
  return groupId as GroupId;
};