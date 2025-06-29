/**
 * Sync handler extensions for group functionality.
 */

import type { SyncConfig } from "./Sync.js";
import { 
  applyProtocolMessageAsClient,
  createProtocolMessageForSync,
  type ProtocolMessage, 
  type StorageDep,
  type BinaryOwnerId,
  type ownerIdToBinaryOwnerId
} from "./Protocol.js";
import type { ConsoleDep } from "../Console.js";
import type { SqliteDep } from "../Sqlite.js";
import type { PostMessageDep } from "./Db.js";
import type { GroupStorage } from "./GroupProtocolHandler.js";
import { extractGroupInfo, routeMessageToPartition } from "./GroupProtocolHandler.js";
import type { GroupId } from "./GroupSchema.js";
import type { OwnerId, OwnerRow } from "./Owner.js";

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
 * Creates a group-aware sync open handler.
 * 
 * This extends the basic sync open handler to support group synchronization.
 */
export const createGroupSyncOpenHandler = (
  deps: StorageDep & ConsoleDep & { ownerRowRef: GroupOwnerRowRef }
): SyncConfig["onOpen"] => (send) => {
  const owner = deps.ownerRowRef.get();
  const ownerId = owner.id;
  
  // If this owner is part of a group, we'll need to sync group data
  if (owner.groupId) {
    deps.console.log("[db]", "group sync detected", owner.groupId);
  }
  
  const message = createProtocolMessageForSync(deps)(ownerId);
  if (message) {
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
  
  // Extract group information if available
  const groupInfo = extractGroupInfo(input as ProtocolMessage);
  if (groupInfo?.groupId) {
    deps.console.log("[db]", "group message detected", groupInfo);
  }
  
  const { writeKey } = deps.ownerRowRef.get();
  
  const output = deps.sqlite.transaction(() =>
    applyProtocolMessageAsClient(deps)(input, {
      getWriteKey: (_ownerId) => writeKey,
    }),
  );
  
  if (!output.ok) {
    deps.postMessage({ type: "onError", error: output.error });
    return;
  }
  
  if (output.value) {
    deps.console.log("[db]", "respond sync message", output.value);
    send(output.value);
  }
};

/**
 * Wraps existing sync handlers to add group support.
 * 
 * This maintains backward compatibility while adding group functionality.
 */
export const wrapSyncHandlersForGroups = <T extends SyncConfig>(
  config: T,
  groupStorage?: GroupStorage
): T => {
  // For Phase 1, we return the config as-is
  // In Phase 2, we'll intercept and enhance the handlers
  return config;
};