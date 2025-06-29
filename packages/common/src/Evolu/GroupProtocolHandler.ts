/**
 * Protocol handler for group-aware messages.
 * 
 * Extends the standard protocol handlers to support group operations
 * and group-based message routing.
 */

import type { 
  ApplyProtocolMessageAsClientOptions, 
  ApplyProtocolMessageAsRelayOptions,
  ProtocolMessage,
  BinaryOwnerId,
  EncryptedCrdtMessage,
  ProtocolError,
  ProtocolInvalidDataError,
  ProtocolWriteKeyError,
  StorageDep,
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
 * Group-aware storage operations.
 */
export interface GroupStorage {
  /**
   * Validates whether an owner has access to a group.
   */
  readonly validateGroupAccess: (
    ownerId: BinaryOwnerId,
    groupId: GroupId,
    epochNumber: NonNegativeInt
  ) => Result<boolean, SqliteError>;
  
  /**
   * Gets the current epoch for a group.
   */
  readonly getGroupEpoch: (groupId: GroupId) => Result<NonNegativeInt, SqliteError>;
  
  /**
   * Validates whether a group operation is allowed.
   */
  readonly validateGroupOperation: (
    ownerId: BinaryOwnerId,
    operation: GroupOperationType,
    groupId: GroupId,
    targetId?: NonEmptyString
  ) => Result<boolean, SqliteError>;
  
  /**
   * Records a group operation in the audit log.
   */
  readonly recordGroupOperation: (
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
export interface GroupProtocolError {
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
  // TODO: Phase 2 - implement group message validation
  // This will require parsing the binary protocol message to extract:
  // - Owner ID
  // - Group context (groupId, epochNumber)
  // - Group operations
  // For now, all messages pass validation
  return ok();
};

/**
 * Processes group operations in a protocol message.
 */
const processGroupOperations = (
  message: GroupProtocolMessage,
  storage: GroupStorage
): Result<void, SqliteError> => {
  // TODO: Phase 2 - implement group operation processing
  // This will parse the binary message and record operations
  return ok();
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
  return filterMessagesByGroup(messages, groupId);
};

/**
 * Creates group-aware applyProtocolMessageAsClient.
 */
export const createGroupApplyProtocolMessageAsClient = (
  baseApplyFactory: typeof applyProtocolMessageAsClient,
  storage: GroupStorage
) => (deps: StorageDep) => {
  const baseApply = baseApplyFactory(deps);
  return (
    protocolMessage: Uint8Array,
    clientStorage?: ApplyProtocolMessageAsClientOptions
  ): Result<ProtocolMessage | null, ProtocolError> => {
    // Validate group access
    const validation = validateGroupMessage(protocolMessage as GroupProtocolMessage, storage);
    if (!validation.ok) {
      // Convert group errors to protocol errors
      return err<ProtocolError>({
        type: "ProtocolInvalidDataError",
        data: protocolMessage,
        error: validation.error,
      });
    }
    
    // Apply base protocol
    return baseApply(protocolMessage, clientStorage);
  };
};

/**
 * Creates group-aware applyProtocolMessageAsRelay.
 */
export const createGroupApplyProtocolMessageAsRelay = (
  baseApplyFactory: typeof applyProtocolMessageAsRelay,
  storage: GroupStorage
) => (deps: StorageDep) => {
  const baseApply = baseApplyFactory(deps);
  return (
    protocolMessage: Uint8Array,
    relayStorage?: ApplyProtocolMessageAsRelayOptions,
    version?: NonNegativeInt
  ): Result<ProtocolMessage | null, ProtocolInvalidDataError> => {
    // Validate group access
    const validation = validateGroupMessage(protocolMessage as GroupProtocolMessage, storage);
    if (!validation.ok) {
      // Convert group errors to protocol errors
      return err<ProtocolInvalidDataError>({
        type: "ProtocolInvalidDataError",
        data: protocolMessage,
        error: validation.error,
      });
    }
    
    // Apply base protocol
    return baseApply(protocolMessage, relayStorage, version);
  };
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