/**
 * Protocol handler extensions for group functionality.
 */

import type { 
  ProtocolMessage,
  applyProtocolMessageAsClient,
  createProtocolMessageForSync,
  Storage,
  BinaryOwnerId
} from "./Protocol.js";
import { isGroupProtocolMessage, type GroupProtocolMessage } from "./GroupProtocolMessage.js";
import type { Result } from "../Result.js";
import type { SqliteError } from "../Sqlite.js";
import type { GroupId } from "./GroupSchema.js";

/**
 * Extended storage interface for group-aware operations.
 */
export interface GroupStorage extends Storage {
  /**
   * Get the group ID associated with an owner ID, if any.
   */
  readonly getGroupId: (ownerId: BinaryOwnerId) => GroupId | null;
  
  /**
   * Validate that the owner has access to the specified group.
   */
  readonly validateGroupAccess: (ownerId: BinaryOwnerId, groupId: GroupId) => boolean;
  
  /**
   * Get the current epoch number for a group.
   */
  readonly getGroupEpoch: (groupId: GroupId) => number;
}

/**
 * Creates a group-aware protocol message handler.
 * 
 * This wraps the existing protocol handlers to add group support
 * while maintaining backward compatibility.
 */
export const createGroupProtocolHandler = <T extends Function>(
  originalHandler: T,
  groupStorage: GroupStorage
): T => {
  // For now, we'll return the original handler as-is
  // In Phase 2, we'll add group message routing and validation
  return originalHandler;
};

/**
 * Extracts group information from a protocol message.
 */
export const extractGroupInfo = (
  message: ProtocolMessage
): { groupId?: GroupId; epochNumber?: number } | null => {
  // This will be implemented when we add binary encoding support
  // For now, return null to indicate no group info
  return null;
};

/**
 * Routes a message to the appropriate storage partition based on group.
 */
export const routeMessageToPartition = (
  message: ProtocolMessage | GroupProtocolMessage,
  storage: GroupStorage
): string => {
  if (isGroupProtocolMessage(message)) {
    return `group:${message.groupId}:${message.epochNumber}`;
  }
  return "default";
};