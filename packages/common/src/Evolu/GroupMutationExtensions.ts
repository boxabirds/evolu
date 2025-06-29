/**
 * Group mutation extensions for Evolu.
 * 
 * This module extends mutations to work with group contexts by leveraging
 * the Phase 0 multi-owner foundation.
 */

import type { MutationOptions } from "./Schema.js";
import type { GroupContext } from "./GroupAPI.js";
import type { DataOwner } from "./MultiOwnerAPI.js";
import type { GroupId } from "./GroupSchema.js";
import { OwnerId } from "./Owner.js";

/**
 * Extended mutation options that support group context.
 */
export interface GroupMutationOptions extends MutationOptions {
  /**
   * The group context to use for this mutation. If specified, the mutation
   * will be performed in the context of the group, creating a DataOwner
   * internally.
   * 
   * If both `groupContext` and `owner` are specified, `owner` takes precedence.
   */
  readonly groupContext?: GroupContext;
}

/**
 * Convert a group context to a DataOwner.
 * 
 * This creates a DataOwner representing the group for Phase 0 multi-owner support.
 */
export const groupContextToDataOwner = (
  context: GroupContext
): DataOwner => {
  // Convert the GroupId to an OwnerId for the multi-owner system
  const ownerId = context.groupId as unknown as OwnerId;
  
  return {
    type: "group",
    id: ownerId,
  };
};

/**
 * Enhance mutation options with group context support.
 * 
 * If a groupContext is provided and no owner is specified, this creates
 * a DataOwner from the group context.
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
  
  // If groupContext is provided, convert to DataOwner
  if (groupContext) {
    return {
      ...baseOptions,
      owner: groupContextToDataOwner(groupContext),
    };
  }
  
  // Otherwise return options unchanged
  return options;
};

/**
 * Check if a DataOwner represents a group context.
 */
export const isGroupDataOwner = (owner: DataOwner): boolean => {
  return owner.type === "group";
};

/**
 * Extract GroupId from a group DataOwner.
 */
export const extractGroupIdFromDataOwner = (
  owner: DataOwner
): GroupId | null => {
  if (owner.type === "group") {
    return owner.id as unknown as GroupId;
  }
  return null;
};

// Legacy exports for backward compatibility during transition
// These will be removed once all Group code is updated

/**
 * Legacy SharedOwner interface for backward compatibility.
 * @deprecated Use DataOwner instead
 */
export interface LegacySharedOwner {
  readonly id: string;
  readonly type: "shared";
}

/**
 * @deprecated Use groupContextToDataOwner instead
 */
export const groupContextToSharedOwner = (
  context: GroupContext
): LegacySharedOwner => {
  return {
    id: `group:${context.groupId}`,
    type: "shared",
  };
};

/**
 * @deprecated Use isGroupDataOwner instead  
 */
export const isGroupSharedOwner = (owner: any): owner is LegacySharedOwner => {
  return owner && owner.type === "shared" && typeof owner.id === "string" && owner.id.startsWith("group:");
};

/**
 * @deprecated Use extractGroupIdFromDataOwner instead
 */
export const extractGroupIdFromSharedOwner = (owner: any): GroupId | null => {
  if (isGroupSharedOwner(owner)) {
    const groupIdPart = owner.id.replace("group:", "");
    return groupIdPart as GroupId;
  }
  return null;
};