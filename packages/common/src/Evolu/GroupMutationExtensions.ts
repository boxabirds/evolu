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
  // Phase 2 will derive these from group epoch keys
  
  // Create a dummy mnemonic for now
  const dummyMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about" as import("../Type.js").Mnemonic;
  
  // Create placeholder writeKey
  const writeKeyBytes = new Uint8Array(16);
  // Fill with dummy data for Phase 1
  for (let i = 0; i < 16; i++) {
    writeKeyBytes[i] = i;
  }
  const writeKey = writeKeyBytes as import("./Owner.js").WriteKey;
  
  return {
    type: "SharedOwner",
    mnemonic: dummyMnemonic,
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
 * Phase 1: This is a placeholder - we can't determine this from SharedOwner alone.
 * Phase 2: Will use proper group key derivation.
 */
export const isGroupSharedOwner = (owner: SharedOwner): boolean => {
  // Phase 1: Always return false since we can't determine this
  return false;
};

/**
 * Extract GroupId from a group SharedOwner.
 * Phase 1: This is a placeholder - we can't extract GroupId from SharedOwner.
 * Phase 2: Will use proper group key mapping.
 */
export const extractGroupIdFromSharedOwner = (
  owner: SharedOwner
): GroupId | null => {
  // Phase 1: Always return null since we can't extract this
  return null;
};