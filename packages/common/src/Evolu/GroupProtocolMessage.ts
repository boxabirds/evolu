/**
 * Protocol message extensions for group functionality.
 */

import type { ProtocolMessage, Base64Url256 } from "./Protocol.js";
import type { GroupId, EpochNumber } from "./GroupSchema.js";

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
  readonly epochNumber?: EpochNumber;
  
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
  epochNumber: EpochNumber,
  groupMetadata?: Base64Url256
): GroupProtocolMessage => {
  return {
    ...message,
    groupId,
    epochNumber,
    groupMetadata,
  };
};