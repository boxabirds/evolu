/**
 * 💾
 *
 * @module
 */

export { createEvolu } from "./Evolu.js";
export type {
  Evolu,
  EvoluConfigWithInitialData,
  EvoluDeps,
  EvoluError,
} from "./Evolu.js";
export * from "./Owner.js";
export { binaryIdToId, idToBinaryId } from "./Protocol.js";
export type { BinaryId } from "./Protocol.js";
export * as kysely from "./PublicKysely.js";
export type { InferRow, Query, QueryRows, Row } from "./Query.js";
export { formatValidMutationSizeError } from "./Schema.js";
export type { EvoluSchema, ValidMutationSizeError } from "./Schema.js";
export type {
  NetworkError,
  PaymentRequiredError,
  ServerError,
  SyncState,
  SyncStateInitial,
  SyncStateIsNotSynced,
  SyncStateIsSynced,
  SyncStateIsSyncing,
} from "./Sync.js";
export {
  binaryTimestampToTimestamp,
  Timestamp,
  timestampToBinaryTimestamp,
} from "./Timestamp.js";
export type {
  BinaryTimestamp,
  TimestampCounterOverflowError,
  TimestampDriftError,
  TimestampDuplicateNodeError,
  TimestampError,
  TimestampTimeOutOfRangeError,
} from "./Timestamp.js";

// Group functionality exports
export type {
  Group,
  GroupId,
  GroupRole,
  MemberId,
  EpochId,
  EpochKeyId,
} from "./GroupSchema.js";

export type {
  GroupConfig,
} from "./GroupConfig.js";
export { hasGroupsEnabled } from "./GroupConfig.js";

export type {
  EvoluWithGroups,
  GroupContext,
  MutationContextOptions,
} from "./GroupAPI.js";
export { hasGroupSupport } from "./GroupAPI.js";

export type {
  GroupManager,
  GroupMember,
  GroupWithMembers,
  GroupError,
} from "./GroupManager.js";

export type {
  GroupInvite,
  GroupInviteManager,
  InviteError,
  InviteValidation,
} from "./GroupInvite.js";

export type {
  GroupMutationOptions,
} from "./GroupMutationExtensions.js";
export {
  groupContextToSharedOwner,
  isGroupSharedOwner,
  extractGroupIdFromSharedOwner,
} from "./GroupMutationExtensions.js";

export { createGroupAwareEvolu, isGroupAwareEvolu } from "./GroupEvolu.js";
export type { GroupEvoluDeps } from "./GroupEvolu.js";
