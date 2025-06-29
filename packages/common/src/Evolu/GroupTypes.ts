import { id } from "../Type.js";

/**
 * Branded ID types for group functionality
 */

/** Group identifier */
export const GroupId = id("Group");
export type GroupId = typeof GroupId.Type;

/** Group member identifier */
export const MemberId = id("Member");
export type MemberId = typeof MemberId.Type;

/** Epoch identifier */
export const EpochId = id("Epoch");
export type EpochId = typeof EpochId.Type;

/** Epoch key identifier */
export const EpochKeyId = id("EpochKey");
export type EpochKeyId = typeof EpochKeyId.Type;

/** Group member roles */
export type GroupRole = "admin" | "member";

/** Group member information */
export interface GroupMember {
  id: MemberId;
  userId: string;
  groupId: GroupId;
  role: GroupRole;
  publicKey: string;
  joinedAt: Date;
  leftAt?: Date;
}

/** Group information */
export interface Group {
  id: GroupId;
  name: string;
  currentEpoch: number;
  createdAt: Date;
  createdBy: string;
}

/** Epoch information */
export interface Epoch {
  id: EpochId;
  groupId: GroupId;
  epochNumber: number;
  startedAt: Date;
  endedAt?: Date;
  keyHash?: string;
}

/** Group context for mutations */
export interface GroupContext {
  groupId: GroupId;
  role: GroupRole;
}

/** Group with members for API responses */
export interface GroupWithMembers extends Group {
  members: GroupMember[];
}

/** Group invite information */
export interface GroupInvite {
  inviteCode: string;
  groupId: GroupId;
  role: GroupRole;
  expiresAt: Date;
  maxUses?: number;
  usedCount: number;
  createdBy: string;
  createdAt: Date;
}

/** Error types for group operations */
export type GroupError = 
  | { type: "GroupNotFound"; groupId: GroupId }
  | { type: "InsufficientPermissions"; required: GroupRole; actual: GroupRole }
  | { type: "MemberNotFound"; memberId: MemberId }
  | { type: "AlreadyMember"; userId: string; groupId: GroupId }
  | { type: "CannotRemoveLastAdmin"; groupId: GroupId }
  | { type: "InvalidEpoch"; expected: number; actual: number };

/** Error types for invite operations */
export type InviteError =
  | { type: "InvalidInviteCode"; code: string }
  | { type: "InviteExpired"; code: string }
  | { type: "InviteUsageExceeded"; code: string; maxUses: number }
  | { type: "InviteNotFound"; code: string };