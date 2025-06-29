/**
 * Database extensions for group functionality.
 * 
 * This module extends the existing database functionality to support
 * group-based data partitioning and synchronization.
 */

import type { DbWorkerInput, DbWorkerOutput } from "./Db.js";
import { hasGroupsEnabled, type GroupConfig } from "./GroupConfig.js";
import type { Config } from "./Config.js";
import type { GroupStorage } from "./GroupProtocolHandler.js";
import type { SqliteDep, SqliteError } from "../Sqlite.js";
import type { Result } from "../Result.js";
import { ok, err } from "../Result.js";
import { createGroupTables, groupTablesExist } from "./GroupDbInit.js";

/**
 * Extended DbWorker input that includes group operations.
 */
export type GroupDbWorkerInput = DbWorkerInput | {
  readonly type: "createGroup";
  readonly name: string;
  readonly members: ReadonlyArray<string>;
} | {
  readonly type: "joinGroup";
  readonly groupId: string;
  readonly inviteCode: string;
} | {
  readonly type: "leaveGroup";
  readonly groupId: string;
};

/**
 * Extended DbWorker output that includes group events.
 */
export type GroupDbWorkerOutput = DbWorkerOutput | {
  readonly type: "onGroupCreated";
  readonly groupId: string;
} | {
  readonly type: "onGroupJoined";
  readonly groupId: string;
} | {
  readonly type: "onGroupLeft";
  readonly groupId: string;
};

/**
 * Initializes group tables if groups are enabled in config.
 */
export const initializeGroupTables = (
  deps: SqliteDep,
  config: Config
): Result<void, SqliteError> => {
  // Check if groups are enabled
  if (!hasGroupsEnabled(config)) {
    return ok();
  }
  
  // Check if tables already exist
  const exists = groupTablesExist(deps);
  if (!exists.ok) return exists;
  
  if (exists.value) {
    // Tables already exist
    return ok();
  }
  
  // Create group tables
  return createGroupTables(deps);
};

/**
 * Creates a group-aware storage implementation.
 * 
 * This wraps the existing storage to add group-specific functionality.
 */
export const createGroupAwareStorage = <T extends object>(
  baseStorage: T,
  deps: SqliteDep
): T & Partial<GroupStorage> => {
  // For Phase 1, we just return the base storage
  // In Phase 2, we'll add the group-specific methods
  return {
    ...baseStorage,
    // These will be implemented in Phase 2
    getGroupId: () => null,
    validateGroupAccess: () => false,
    getGroupEpoch: () => 0,
  };
};

/**
 * Handles group-specific DbWorker messages.
 */
export const handleGroupDbWorkerMessage = (
  message: GroupDbWorkerInput,
  postMessage: (output: GroupDbWorkerOutput) => void
): boolean => {
  switch (message.type) {
    case "createGroup":
      // Phase 2: Implement group creation
      postMessage({
        type: "onGroupCreated",
        groupId: "group-placeholder",
      });
      return true;
      
    case "joinGroup":
      // Phase 2: Implement group joining
      postMessage({
        type: "onGroupJoined",
        groupId: message.groupId,
      });
      return true;
      
    case "leaveGroup":
      // Phase 2: Implement group leaving
      postMessage({
        type: "onGroupLeft",
        groupId: message.groupId,
      });
      return true;
      
    default:
      // Not a group message
      return false;
  }
};