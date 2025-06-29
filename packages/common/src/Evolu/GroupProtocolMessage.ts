/**
 * Protocol message extensions for group functionality.
 * 
 * Extends the Evolu Protocol to support group operations including
 * membership management, epoch rotation, and group-specific sync.
 */

import type { 
  ProtocolMessage, 
  Base64Url256,
  BinaryOwnerId,
  EncryptedCrdtMessage,
} from "./Protocol.js";
import type { GroupId } from "./GroupTypes.js";
import type { NonEmptyString, NonNegativeInt } from "../Type.js";

/**
 * Group operation types for protocol messages.
 */
export type GroupOperationType = 
  | "group_create"
  | "member_add"
  | "member_remove" 
  | "member_update_role"
  | "epoch_rotate"
  | "invite_create"
  | "invite_use"
  | "invite_revoke"
  | "group_update"
  | "group_sync";

/**
 * Group operation metadata included in protocol messages.
 */
export interface GroupOperationMetadata {
  readonly operation: GroupOperationType;
  readonly groupId: GroupId;
  readonly epochNumber: NonNegativeInt;
  readonly actorId: NonEmptyString;
  readonly targetId?: NonEmptyString;
  readonly data?: unknown; // Operation-specific data
}

/**
 * Group protocol message is just a regular protocol message.
 * Group metadata is embedded within the binary data.
 */
export type GroupProtocolMessage = ProtocolMessage;

/**
 * Type guard to check if a protocol message is a group message.
 * For now, all messages are treated as potential group messages.
 */
export const isGroupProtocolMessage = (
  message: ProtocolMessage
): message is GroupProtocolMessage => {
  // In Phase 2, this will parse the binary data to check for group metadata
  return true;
};

/**
 * Creates a group protocol message from a regular protocol message.
 */
export const createGroupProtocolMessage = (
  message: ProtocolMessage,
  groupId: GroupId,
  epochNumber: NonNegativeInt,
  groupOperation?: GroupOperationMetadata,
  groupMetadata?: Base64Url256
): GroupProtocolMessage => {
  // TODO: Phase 2 - encode group metadata into the binary message
  // For now, just return the original message
  return message;
};

/**
 * Filters encrypted messages by group ID.
 */
export const filterMessagesByGroup = (
  messages: readonly EncryptedCrdtMessage[],
  groupId: GroupId
): readonly EncryptedCrdtMessage[] => {
  // In Phase 2, we'll add actual filtering based on message content
  // For now, return all messages
  return messages;
};

/**
 * Validates that a protocol message has required group fields.
 */
export const validateGroupProtocolMessage = (
  message: unknown
): message is GroupProtocolMessage => {
  if (!message || typeof message !== 'object') return false;
  
  const msg = message as any;
  
  // Check if it's a valid base protocol message
  if (typeof msg.protocolVersion !== 'number' || !msg.ownerId) return false;
  
  // If it has group fields, validate them
  if (msg.groupId !== undefined) {
    if (typeof msg.groupId !== 'string') return false;
    if (msg.epochNumber !== undefined && typeof msg.epochNumber !== 'number') return false;
    if (msg.groupOperation !== undefined) {
      const op = msg.groupOperation;
      if (!op.operation || !op.groupId || typeof op.epochNumber !== 'number' || !op.actorId) {
        return false;
      }
    }
  }
  
  return true;
};

/**
 * Extracts group context from a protocol message.
 */
export interface GroupContext {
  readonly groupId: GroupId;
  readonly epochNumber: NonNegativeInt;
  readonly operation?: GroupOperationType;
}

export const extractGroupContext = (
  message: ProtocolMessage | GroupProtocolMessage
): GroupContext | null => {
  // In Phase 2, this will parse the binary data to extract group metadata
  // For now, return null (no group context)
  return null;
};