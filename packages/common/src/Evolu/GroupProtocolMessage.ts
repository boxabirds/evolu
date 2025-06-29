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
  NonNegativeInt,
} from "./Protocol.js";
import type { GroupId } from "./GroupTypes.js";
import type { NonEmptyString } from "../Type.js";

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
 * Extended protocol message that includes group-specific fields.
 */
export interface GroupProtocolMessage extends ProtocolMessage {
  /**
   * The group ID this message belongs to, if any.
   * Used for partitioning messages by group.
   */
  readonly groupId?: GroupId;
  
  /**
   * The epoch number when this message was created.
   * Used for epoch-based key management.
   */
  readonly epochNumber?: NonNegativeInt;
  
  /**
   * Group operation metadata.
   * Describes the group operation being performed.
   */
  readonly groupOperation?: GroupOperationMetadata;
  
  /**
   * Group-specific metadata encoded as base64url.
   * Can include member information, permissions, etc.
   */
  readonly groupMetadata?: Base64Url256;
}

/**
 * Type guard to check if a protocol message is a group message.
 */
export const isGroupProtocolMessage = (
  message: ProtocolMessage
): message is GroupProtocolMessage => {
  return 'groupId' in message && message.groupId !== undefined;
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
  return {
    ...message,
    groupId,
    epochNumber,
    groupOperation,
    groupMetadata,
  };
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
  if (!isGroupProtocolMessage(message) || !message.groupId) {
    return null;
  }
  
  return {
    groupId: message.groupId,
    epochNumber: message.epochNumber || 0,
    operation: message.groupOperation?.operation,
  };
};