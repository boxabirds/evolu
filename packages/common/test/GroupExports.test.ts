import { expect, test, describe } from "vitest";
import type { DateIsoString } from "../src/Type.js";
import {
  // Group types
  type Group,
  type GroupId,
  type GroupRole,
  type MemberId,
  type EpochId,
  type EpochKeyId,
  
  // Config
  type GroupConfig,
  hasGroupsEnabled,
  
  // API
  type EvoluWithGroups,
  type GroupContext,
  type MutationContextOptions,
  hasGroupSupport,
  
  // Manager
  type GroupManager,
  type GroupMember,
  type GroupWithMembers,
  type GroupError,
  
  // Invite
  type GroupInvite,
  type GroupInviteManager,
  type InviteError,
  type InviteValidation,
  
  // Mutations
  type GroupMutationOptions,
  groupContextToSharedOwner,
  isGroupSharedOwner,
  extractGroupIdFromSharedOwner,
  
  // Main integration
  createGroupAwareEvolu,
  isGroupAwareEvolu,
  type GroupEvoluDeps,
} from "../src/index.js";

describe("Group TypeScript Exports", () => {
  test("all group types are exported", () => {
    // This test verifies that TypeScript can import all the types
    // If any import fails, the test file won't compile
    
    // Type assertions to ensure types exist
    const groupId: GroupId = "group-123" as GroupId;
    const memberId: MemberId = "member-123" as MemberId;
    const epochId: EpochId = "epoch-123" as EpochId;
    const epochKeyId: EpochKeyId = "key-123" as EpochKeyId;
    
    expect(groupId).toBeDefined();
    expect(memberId).toBeDefined();
    expect(epochId).toBeDefined();
    expect(epochKeyId).toBeDefined();
  });
  
  test("all group functions are exported", () => {
    expect(hasGroupsEnabled).toBeDefined();
    expect(hasGroupSupport).toBeDefined();
    expect(groupContextToSharedOwner).toBeDefined();
    expect(isGroupSharedOwner).toBeDefined();
    expect(extractGroupIdFromSharedOwner).toBeDefined();
    expect(createGroupAwareEvolu).toBeDefined();
    expect(isGroupAwareEvolu).toBeDefined();
  });
  
  test("config type guard works", () => {
    const configWithGroups: GroupConfig = {
      name: "test" as any,
      syncUrl: "wss://test.com",
      reloadUrl: "/",
      maxDrift: 5000,
      enableLogging: false,
      enableGroups: true,
    };
    
    const configWithoutGroups = {
      name: "test" as any,
      syncUrl: "wss://test.com",
      reloadUrl: "/",
      maxDrift: 5000,
      enableLogging: false,
    };
    
    expect(hasGroupsEnabled(configWithGroups)).toBe(true);
    expect(hasGroupsEnabled(configWithoutGroups)).toBe(false);
  });
  
  test("group context to shared owner conversion works", () => {
    const context: GroupContext = {
      groupId: "group-456" as GroupId,
      role: "admin",
    };
    
    const sharedOwner = groupContextToSharedOwner(context);
    
    expect(sharedOwner.id).toBe("group:group-456");
    expect(isGroupSharedOwner(sharedOwner)).toBe(true);
    expect(extractGroupIdFromSharedOwner(sharedOwner)).toBe("group-456");
  });
  
  test("type interfaces are properly structured", () => {
    // Test that we can create objects matching the interfaces
    const group: Group = {
      id: "group-1" as GroupId,
      name: "Test Group",
      currentEpoch: 1,
      createdAt: new Date(),
      createdBy: "user-1",
    };
    
    const member: GroupMember = {
      id: "member-1" as MemberId,
      userId: "user-1",
      role: "admin" as GroupRole,
      publicKey: "key",
      joinedAt: new Date().toISOString() as DateIsoString,
    };
    
    const invite: GroupInvite = {
      id: "invite-id-1",
      inviteCode: "invite-123",
      groupId: "group-1" as GroupId,
      role: "member" as GroupRole,
      expiresAt: new Date().toISOString(),
      maxUses: 10,
      usedCount: 0,
      createdBy: "user-1",
      createdAt: new Date().toISOString(),
      isRevoked: false,
    };
    
    expect(group).toBeDefined();
    expect(member).toBeDefined();
    expect(invite).toBeDefined();
  });
});