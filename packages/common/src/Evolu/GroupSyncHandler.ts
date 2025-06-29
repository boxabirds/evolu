/**
 * Sync handler extensions for group functionality.
 * 
 * Provides group-aware synchronization by extending the base sync protocol
 * with group operation support, epoch-based versioning, and member filtering.
 */

import type { SyncConfig, SyncState } from "./Sync.js";
import { 
  applyProtocolMessageAsClient,
  createProtocolMessageForSync,
  type ProtocolMessage, 
  type StorageDep,
  type BinaryOwnerId,
  type Range,
} from "./Protocol.js";
import type { ConsoleDep } from "../Console.js";
import type { SqliteDep } from "../Sqlite.js";
import type { PostMessageDep } from "./Db.js";
import { 
  type GroupStorage,
  createGroupClientHandler,
  createGroupSyncHandler,
  filterGroupMessages,
  requiresGroupProcessing,
} from "./GroupProtocolHandler.js";
import { 
  isGroupProtocolMessage,
  extractGroupContext,
  type GroupProtocolMessage,
  type GroupOperationType,
} from "./GroupProtocolMessage.js";
import type { GroupId } from "./GroupTypes.js";
import type { OwnerId, OwnerRow } from "./Owner.js";
import { ok, type Result } from "../Result.js";
import type { SqliteError } from "../Sqlite.js";

/**
 * Dependencies for group-aware sync handling.
 */
export interface GroupSyncDeps extends 
  PostMessageDep, 
  StorageDep, 
  SqliteDep, 
  ConsoleDep {
  readonly groupStorage?: GroupStorage;
}

/**
 * Extended owner row reference that includes group information.
 */
export interface GroupOwnerRowRef {
  readonly get: () => OwnerRow & { groupId?: GroupId };
}

/**
 * Group sync state tracking.
 */
interface GroupSyncState {
  readonly groupId: GroupId;
  readonly epochNumber: number;
  readonly lastSyncedEpoch: number;
  readonly pendingOperations: readonly GroupOperationType[];
}

/**
 * Creates a group-aware sync open handler.
 * 
 * This extends the basic sync open handler to support group synchronization.
 */
export const createGroupSyncOpenHandler = (
  deps: StorageDep & ConsoleDep & { 
    ownerRowRef: GroupOwnerRowRef;
    groupStorage?: GroupStorage;
  }
): SyncConfig["onOpen"] => (send) => {
  const owner = deps.ownerRowRef.get();
  const ownerId = owner.id;
  
  // Create base sync message
  const createMessage = deps.groupStorage 
    ? createGroupSyncHandler(
        createProtocolMessageForSync(deps),
        deps.groupStorage
      )
    : createProtocolMessageForSync(deps);
  
  const messageResult = createMessage(ownerId);
  
  if (!messageResult.ok) {
    deps.console.error("[db]", "failed to create sync message", messageResult.error);
    return;
  }
  
  const message = messageResult.value;
  if (message) {
    // Log group context if present
    if (isGroupProtocolMessage(message)) {
      const context = extractGroupContext(message);
      if (context) {
        deps.console.log("[db]", "group sync open", {
          groupId: context.groupId,
          epochNumber: context.epochNumber,
        });
      }
    }
    
    deps.console.log("[db]", "send initial sync message", message);
    send(message);
  }
};

/**
 * Creates a group-aware sync message handler.
 * 
 * This extends the basic sync message handler to route messages
 * to appropriate group partitions.
 */
export const createGroupSyncMessageHandler = (
  deps: GroupSyncDeps & { ownerRowRef: GroupOwnerRowRef }
): SyncConfig["onMessage"] => (input, send) => {
  deps.console.log("[db]", "receive sync message", input);
  
  const protocolMessage = input as ProtocolMessage;
  
  // Log group context if present
  if (isGroupProtocolMessage(protocolMessage)) {
    const context = extractGroupContext(protocolMessage);
    if (context) {
      deps.console.log("[db]", "group message received", {
        groupId: context.groupId,
        epochNumber: context.epochNumber,
        operation: context.operation,
      });
    }
  }
  
  const { writeKey } = deps.ownerRowRef.get();
  
  // Use group-aware handler if available
  const handler = deps.groupStorage
    ? createGroupClientHandler(
        applyProtocolMessageAsClient(deps),
        deps.groupStorage
      )
    : applyProtocolMessageAsClient(deps);
  
  const output = deps.sqlite.transaction(() =>
    handler(protocolMessage, {
      getWriteKey: (_ownerId) => writeKey,
    }),
  );
  
  if (!output.ok) {
    // Handle group-specific errors
    if (output.error && output.error.type === "GroupProtocolError") {
      deps.console.error("[db]", "group protocol error", {
        groupId: output.error.groupId,
        reason: output.error.reason,
      });
    }
    deps.postMessage({ type: "onError", error: output.error });
    return;
  }
  
  if (output.value) {
    // Enhance response with group context if needed
    let response = output.value;
    
    if (deps.groupStorage && requiresGroupProcessing(protocolMessage)) {
      const context = extractGroupContext(protocolMessage);
      if (context) {
        // Add group context to response
        response = {
          ...response,
          groupId: context.groupId,
          epochNumber: context.epochNumber,
        } as GroupProtocolMessage;
      }
    }
    
    deps.console.log("[db]", "respond sync message", response);
    send(response);
  }
};

/**
 * Creates group-aware sync configuration.
 */
export const createGroupSyncConfig = (
  deps: GroupSyncDeps & { ownerRowRef: GroupOwnerRowRef },
  baseConfig?: Partial<SyncConfig>
): SyncConfig => {
  return {
    onOpen: createGroupSyncOpenHandler(deps),
    onMessage: createGroupSyncMessageHandler(deps),
    onError: baseConfig?.onError || ((error) => {
      deps.console.error("[db]", "sync error", error);
      deps.postMessage({ type: "onError", error });
    }),
    onClose: baseConfig?.onClose || (() => {
      deps.console.log("[db]", "sync closed");
    }),
  };
};

/**
 * Filters sync ranges based on group context.
 * 
 * This ensures that group messages are only synced within their epoch boundaries.
 */
export const filterGroupSyncRanges = (
  ranges: readonly Range[],
  groupId: GroupId,
  epochNumber: number,
  storage: GroupStorage
): Result<readonly Range[], SqliteError> => {
  // In Phase 2, we'll implement actual range filtering based on epoch boundaries
  // For now, return ranges as-is
  return ok(ranges);
};

/**
 * Determines if a sync operation should include group data.
 */
export const shouldSyncGroupData = (
  ownerId: OwnerId,
  storage: GroupStorage
): Result<boolean, SqliteError> => {
  const groupIdResult = storage.getGroupId(ownerId as unknown as BinaryOwnerId);
  if (!groupIdResult.ok) return groupIdResult;
  
  return ok(groupIdResult.value !== null);
};

/**
 * Group sync operation types that can be performed during sync.
 */
export type GroupSyncOperation = 
  | { type: "sync_members"; groupId: GroupId; epochNumber: number }
  | { type: "sync_epochs"; groupId: GroupId; fromEpoch: number; toEpoch: number }
  | { type: "sync_activity"; groupId: GroupId; since: Date }
  | { type: "sync_full"; groupId: GroupId };

/**
 * Plans group sync operations based on current state.
 */
export const planGroupSyncOperations = (
  localState: GroupSyncState,
  remoteEpoch: number
): readonly GroupSyncOperation[] => {
  const operations: GroupSyncOperation[] = [];
  
  // If remote is ahead, sync epochs
  if (remoteEpoch > localState.epochNumber) {
    operations.push({
      type: "sync_epochs",
      groupId: localState.groupId,
      fromEpoch: localState.epochNumber,
      toEpoch: remoteEpoch,
    });
  }
  
  // If we have pending operations, sync them
  if (localState.pendingOperations.length > 0) {
    operations.push({
      type: "sync_members",
      groupId: localState.groupId,
      epochNumber: localState.epochNumber,
    });
  }
  
  return operations;
};