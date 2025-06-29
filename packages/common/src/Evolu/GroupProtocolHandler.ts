/**
 * Protocol handler extensions for group functionality.
 * 
 * Provides group-aware message processing, validation, and routing
 * while maintaining backward compatibility with the base protocol.
 */

import type { 
  ProtocolMessage,
  Storage,
  BinaryOwnerId,
  EncryptedCrdtMessage,
  ProtocolError,
  ProtocolWriteKeyError,
  createProtocolMessageForSync,
  applyProtocolMessageAsClient,
  applyProtocolMessageAsRelay,
} from "./Protocol.js";
import { 
  isGroupProtocolMessage, 
  extractGroupContext,
  filterMessagesByGroup,
  type GroupProtocolMessage,
  type GroupOperationType,
  type GroupContext,
} from "./GroupProtocolMessage.js";
import { ok, err, type Result } from "../Result.js";
import type { SqliteError } from "../Sqlite.js";
import type { GroupId } from "./GroupTypes.js";
import type { NonNegativeInt, NonEmptyString } from "../Type.js";

/**
 * Extended storage interface for group-aware operations.
 */
export interface GroupStorage extends Storage {
  /**
   * Get the group ID associated with an owner ID, if any.
   */
  readonly getGroupId: (ownerId: BinaryOwnerId) => Result<GroupId | null, SqliteError>;
  
  /**
   * Validate that the owner has access to the specified group.
   */
  readonly validateGroupAccess: (
    ownerId: BinaryOwnerId, 
    groupId: GroupId,
    epochNumber: NonNegativeInt
  ) => Result<boolean, SqliteError>;
  
  /**
   * Get the current epoch number for a group.
   */
  readonly getGroupEpoch: (groupId: GroupId) => Result<NonNegativeInt, SqliteError>;
  
  /**
   * Validate a group operation.
   */
  readonly validateGroupOperation: (
    ownerId: BinaryOwnerId,
    operation: GroupOperationType,
    groupId: GroupId,
    targetId?: NonEmptyString
  ) => Result<boolean, SqliteError>;
  
  /**
   * Record a group operation in the activity log.
   */
  readonly recordGroupActivity: (
    groupId: GroupId,
    actorId: NonEmptyString,
    operation: GroupOperationType,
    epochNumber: NonNegativeInt,
    targetId?: NonEmptyString,
    metadata?: unknown
  ) => Result<void, SqliteError>;
}

/**
 * Group protocol error for group-specific validation failures.
 */
export interface GroupProtocolError extends ProtocolError {
  readonly type: "GroupProtocolError";
  readonly groupId: GroupId;
  readonly reason: "access_denied" | "invalid_epoch" | "operation_not_allowed" | "group_not_found";
}

/**
 * Validates group access for a protocol message.
 */
const validateGroupMessage = (
  message: GroupProtocolMessage,
  storage: GroupStorage
): Result<void, GroupProtocolError | SqliteError> => {
  const context = extractGroupContext(message);
  if (!context) return ok();
  
  // Validate group access
  const accessResult = storage.validateGroupAccess(
    message.ownerId,
    context.groupId,
    context.epochNumber
  );
  
  if (!accessResult.ok) return accessResult;
  
  if (!accessResult.value) {
    return err<GroupProtocolError>({
      type: "GroupProtocolError",
      ownerId: message.ownerId,
      groupId: context.groupId,
      reason: "access_denied",
    });
  }
  
  // Validate epoch
  const epochResult = storage.getGroupEpoch(context.groupId);
  if (!epochResult.ok) return epochResult;
  
  if (context.epochNumber > epochResult.value) {
    return err<GroupProtocolError>({
      type: "GroupProtocolError",
      ownerId: message.ownerId,
      groupId: context.groupId,
      reason: "invalid_epoch",
    });
  }
  
  // Validate operation if present
  if (message.groupOperation) {
    const op = message.groupOperation;
    const opResult = storage.validateGroupOperation(
      message.ownerId,
      op.operation,
      op.groupId,
      op.targetId
    );
    
    if (!opResult.ok) return opResult;
    
    if (!opResult.value) {
      return err<GroupProtocolError>({
        type: "GroupProtocolError",
        ownerId: message.ownerId,
        groupId: context.groupId,
        reason: "operation_not_allowed",
      });
    }
  }
  
  return ok();
};

/**
 * Processes group operations from a protocol message.
 */
const processGroupOperations = (
  message: GroupProtocolMessage,
  storage: GroupStorage
): Result<void, SqliteError> => {
  if (!message.groupOperation) return ok();
  
  const op = message.groupOperation;
  return storage.recordGroupActivity(
    op.groupId,
    op.actorId,
    op.operation,
    op.epochNumber,
    op.targetId,
    op.data
  );
};

/**
 * Creates a group-aware client message handler.
 */
export const createGroupClientHandler = (
  originalHandler: ReturnType<typeof applyProtocolMessageAsClient>,
  storage: GroupStorage
): ReturnType<typeof applyProtocolMessageAsClient> => {
  return (protocolMessage, clientStorage) => {
    // Validate group access if it's a group message
    if (isGroupProtocolMessage(protocolMessage)) {
      const validationResult = validateGroupMessage(protocolMessage, storage);
      if (!validationResult.ok) {
        return err(validationResult.error);
      }
      
      // Process group operations
      const opsResult = processGroupOperations(protocolMessage, storage);
      if (!opsResult.ok) {
        return err(opsResult.error);
      }
    }
    
    // Call original handler
    return originalHandler(protocolMessage, clientStorage);
  };
};

/**
 * Creates a group-aware relay message handler.
 */
export const createGroupRelayHandler = (
  originalHandler: ReturnType<typeof applyProtocolMessageAsRelay>,
  storage: GroupStorage
): ReturnType<typeof applyProtocolMessageAsRelay> => {
  return (protocolMessage, relayStorage) => {
    // Validate group access if it's a group message
    if (isGroupProtocolMessage(protocolMessage)) {
      const validationResult = validateGroupMessage(protocolMessage, storage);
      if (!validationResult.ok) {
        return err(validationResult.error);
      }
      
      // Process group operations
      const opsResult = processGroupOperations(protocolMessage, storage);
      if (!opsResult.ok) {
        return err(opsResult.error);
      }
    }
    
    // Call original handler
    return originalHandler(protocolMessage, relayStorage);
  };
};

/**
 * Creates a group-aware sync message creator.
 */
export const createGroupSyncHandler = (
  originalHandler: ReturnType<typeof createProtocolMessageForSync>,
  storage: GroupStorage
): ReturnType<typeof createProtocolMessageForSync> => {
  return (ownerId, ranges, options) => {
    // Get group context for the owner
    const groupIdResult = storage.getGroupId(ownerId);
    if (!groupIdResult.ok) return groupIdResult;
    
    const groupId = groupIdResult.value;
    if (!groupId) {
      // Not a group owner, use original handler
      return originalHandler(ownerId, ranges, options);
    }
    
    // Get current epoch
    const epochResult = storage.getGroupEpoch(groupId);
    if (!epochResult.ok) return epochResult;
    
    // Create sync message with original handler
    const result = originalHandler(ownerId, ranges, options);
    if (!result.ok) return result;
    
    // Enhance with group context
    const enhancedMessage: GroupProtocolMessage = {
      ...result.value,
      groupId,
      epochNumber: epochResult.value,
    };
    
    return ok(enhancedMessage);
  };
};

/**
 * Routes a message to the appropriate storage partition based on group.
 */
export const routeMessageToPartition = (
  message: ProtocolMessage | GroupProtocolMessage,
  storage: GroupStorage
): string => {
  const context = extractGroupContext(message);
  if (context) {
    return `group:${context.groupId}:${context.epochNumber}`;
  }
  return "default";
};

/**
 * Filters messages based on group context.
 */
export const filterGroupMessages = (
  messages: readonly EncryptedCrdtMessage[],
  groupId: GroupId,
  epochNumber?: NonNegativeInt
): readonly EncryptedCrdtMessage[] => {
  // In Phase 2, we'll implement actual filtering based on message metadata
  // For now, return all messages
  return messages;
};

/**
 * Checks if a message requires group processing.
 */
export const requiresGroupProcessing = (
  message: ProtocolMessage
): boolean => {
  if (!isGroupProtocolMessage(message)) return false;
  
  const context = extractGroupContext(message);
  return context !== null && context.groupId !== undefined;
};