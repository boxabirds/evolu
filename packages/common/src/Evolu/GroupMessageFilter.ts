/**
 * Group message filtering for protocol synchronization.
 * 
 * Provides filtering capabilities to ensure messages are only synced
 * with authorized group members and within valid epoch boundaries.
 */

import type {
  EncryptedCrdtMessage,
  BinaryOwnerId,
  Range,
  Fingerprint,
  TimestampsRange,
} from "./Protocol.js";
import type { GroupId } from "./GroupTypes.js";
import type { NonNegativeInt, NonEmptyString } from "../Type.js";
import { ok, err, type Result } from "../Result.js";
import type { SqliteError } from "../Sqlite.js";
import type { GroupStorage } from "./GroupProtocolHandler.js";
import { extractGroupContext, type GroupContext } from "./GroupProtocolMessage.js";

/**
 * Message filter criteria for group synchronization.
 */
export interface GroupFilterCriteria {
  readonly groupId: GroupId;
  readonly epochNumber: NonNegativeInt;
  readonly memberIds?: readonly NonEmptyString[];
  readonly includeEpochTransitions?: boolean;
}

/**
 * Filters encrypted messages based on group membership and epoch.
 */
export const filterEncryptedMessagesByGroup = (
  messages: readonly EncryptedCrdtMessage[],
  criteria: GroupFilterCriteria,
  storage: GroupStorage
): Result<readonly EncryptedCrdtMessage[], SqliteError> => {
  // In Phase 2, we'll decrypt message metadata to filter by group
  // For Phase 1, we return all messages as we can't inspect encrypted content
  return ok(messages);
};

/**
 * Validates that a member can access messages from a specific epoch.
 */
export const validateMemberEpochAccess = (
  memberId: NonEmptyString,
  groupId: GroupId,
  epochNumber: NonNegativeInt,
  storage: GroupStorage
): Result<boolean, SqliteError> => {
  // Check if member has access to this epoch
  const accessResult = storage.validateGroupAccess(
    memberId as unknown as BinaryOwnerId,
    groupId,
    epochNumber
  );
  
  return accessResult;
};

/**
 * Filters sync ranges to only include data accessible to a group member.
 */
export const filterRangesByGroupAccess = (
  ranges: readonly Range[],
  groupId: GroupId,
  memberId: NonEmptyString,
  currentEpoch: NonNegativeInt,
  storage: GroupStorage
): Result<readonly Range[], SqliteError> => {
  // Validate member has access to current epoch
  const accessResult = validateMemberEpochAccess(
    memberId,
    groupId,
    currentEpoch,
    storage
  );
  
  if (!accessResult.ok) return accessResult;
  if (!accessResult.value) {
    return ok([]); // No access, return empty ranges
  }
  
  // In Phase 2, we'll filter ranges based on epoch boundaries
  // For now, return all ranges
  return ok(ranges);
};

/**
 * Message visibility rules for group synchronization.
 */
export interface GroupMessageVisibility {
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly epochRange?: {
    readonly minEpoch: NonNegativeInt;
    readonly maxEpoch: NonNegativeInt;
  };
}

/**
 * Determines message visibility for a group member.
 */
export const getMessageVisibility = (
  memberId: NonEmptyString,
  groupId: GroupId,
  storage: GroupStorage
): Result<GroupMessageVisibility, SqliteError> => {
  // Get current epoch
  const epochResult = storage.getGroupEpoch(groupId);
  if (!epochResult.ok) return epochResult;
  
  const currentEpoch = epochResult.value;
  
  // Check access to current epoch
  const accessResult = validateMemberEpochAccess(
    memberId,
    groupId,
    currentEpoch,
    storage
  );
  
  if (!accessResult.ok) return accessResult;
  
  if (!accessResult.value) {
    return ok({
      canRead: false,
      canWrite: false,
    });
  }
  
  // For Phase 1, members can read/write in current epoch only
  return ok({
    canRead: true,
    canWrite: true,
    epochRange: {
      minEpoch: currentEpoch,
      maxEpoch: currentEpoch,
    },
  });
};

/**
 * Filters messages for a specific group member during sync.
 */
export const createGroupMessageFilter = (
  storage: GroupStorage
) => {
  return {
    /**
     * Filters messages before sending to a group member.
     */
    filterOutgoing: (
      messages: readonly EncryptedCrdtMessage[],
      recipientId: NonEmptyString,
      groupId: GroupId
    ): Result<readonly EncryptedCrdtMessage[], SqliteError> => {
      // Get recipient's visibility
      const visibilityResult = getMessageVisibility(recipientId, groupId, storage);
      if (!visibilityResult.ok) return visibilityResult;
      
      const visibility = visibilityResult.value;
      if (!visibility.canRead) {
        return ok([]); // No read access
      }
      
      // Filter messages based on epoch range
      if (visibility.epochRange) {
        return filterEncryptedMessagesByGroup(
          messages,
          {
            groupId,
            epochNumber: visibility.epochRange.maxEpoch,
          },
          storage
        );
      }
      
      return ok(messages);
    },
    
    /**
     * Validates incoming messages from a group member.
     */
    validateIncoming: (
      messages: readonly EncryptedCrdtMessage[],
      senderId: NonEmptyString,
      groupId: GroupId
    ): Result<boolean, SqliteError> => {
      // Get sender's visibility
      const visibilityResult = getMessageVisibility(senderId, groupId, storage);
      if (!visibilityResult.ok) return visibilityResult;
      
      const visibility = visibilityResult.value;
      return ok(visibility.canWrite);
    },
    
    /**
     * Filters ranges for group synchronization.
     */
    filterRanges: (
      ranges: readonly Range[],
      memberId: NonEmptyString,
      groupId: GroupId
    ): Result<readonly Range[], SqliteError> => {
      // Get current epoch
      const epochResult = storage.getGroupEpoch(groupId);
      if (!epochResult.ok) return epochResult;
      
      return filterRangesByGroupAccess(
        ranges,
        groupId,
        memberId,
        epochResult.value,
        storage
      );
    },
  };
};

/**
 * Partition strategy for group messages.
 */
export interface GroupPartitionStrategy {
  readonly getPartitionKey: (context: GroupContext) => string;
  readonly shouldIsolate: (context: GroupContext) => boolean;
}

/**
 * Default partition strategy that isolates by group and epoch.
 */
export const defaultGroupPartitionStrategy: GroupPartitionStrategy = {
  getPartitionKey: (context) => `${context.groupId}:${context.epochNumber}`,
  shouldIsolate: (_context) => true, // Always isolate group messages
};

/**
 * Creates a message router for group synchronization.
 */
export const createGroupMessageRouter = (
  strategy: GroupPartitionStrategy = defaultGroupPartitionStrategy
) => {
  return {
    /**
     * Routes a message to the appropriate partition.
     */
    route: (
      message: EncryptedCrdtMessage,
      context: GroupContext | null
    ): string => {
      if (!context) return "default";
      
      if (strategy.shouldIsolate(context)) {
        return `group:${strategy.getPartitionKey(context)}`;
      }
      
      return "default";
    },
    
    /**
     * Groups messages by partition for batch processing.
     */
    partition: (
      messages: readonly EncryptedCrdtMessage[],
      getContext: (message: EncryptedCrdtMessage) => GroupContext | null
    ): Map<string, readonly EncryptedCrdtMessage[]> => {
      const partitions = new Map<string, EncryptedCrdtMessage[]>();
      
      for (const message of messages) {
        const context = getContext(message);
        const partition = context && strategy.shouldIsolate(context)
          ? `group:${strategy.getPartitionKey(context)}`
          : "default";
        
        const existing = partitions.get(partition) || [];
        existing.push(message);
        partitions.set(partition, existing);
      }
      
      return partitions;
    },
  };
};