import { expect, test, describe } from "vitest";
import { GroupSecurityContext } from "../src/Evolu/GroupSecurityContext.js";
import { GroupId } from "../src/Evolu/GroupTypes.js";
import { createIdFromString } from "../src/Type.js";

describe("GroupSecurityContext", () => {
  const mockDeps = {
    nanoid: (length?: number) => {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < (length || 21); i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    },
  };

  const createTestGroup = () => {
    // Create a valid ID using createIdFromString
    const groupId = createIdFromString<"Group">("test-group-12345678");
    
    return {
      id: groupId as GroupId,
      currentEpoch: 1,
      name: "Test Group",
    };
  };

  test("creates a valid security context", () => {
    const group = createTestGroup();
    const context = new GroupSecurityContext(
      group,
      "member123",
      "admin",
      mockDeps
    );

    expect(context.type).toBe("group");
    expect(context.id).toBe(`group:${group.id}:1`);
    expect(context.metadata).toMatchObject({
      type: "group",
      groupId: group.id,
      groupName: "Test Group",
      epoch: 1,
      memberId: "member123",
      memberRole: "admin",
    });
  });

  test("generates unique NodeIds with correct format", () => {
    const group = createTestGroup();
    const context = new GroupSecurityContext(
      group,
      "member123",
      "member",
      mockDeps
    );

    const nodeId1 = context.createNodeId();
    const nodeId2 = context.createNodeId();

    // NodeIds should be unique
    expect(nodeId1).not.toBe(nodeId2);

    // NodeIds should follow the expected format
    // Note: GroupId might contain special chars like [ and ], so we need a more flexible pattern
    expect(nodeId1).toMatch(/^g.{6}-e[0-9a-z]{2}-mmemb-[\w]+-[\w]{6}$/);
    
    // Should start with 'g' followed by group suffix
    expect(nodeId1.startsWith("g")).toBe(true);
    
    // Should contain epoch encoding
    expect(nodeId1).toContain("-e01-"); // epoch 1 in base36 padded
    
    // Should contain member prefix
    expect(nodeId1).toContain("-mmemb-");
  });

  test("generates correct partition key", () => {
    const group = createTestGroup();
    const context = new GroupSecurityContext(
      group,
      "member123",
      "admin",
      mockDeps
    );

    const partitionKey = context.getPartitionKey();
    expect(partitionKey).toBe(`group:${group.id}:1`);
  });

  test("validates NodeIds correctly", () => {
    const group = createTestGroup();
    const context = new GroupSecurityContext(
      group,
      "member123",
      "admin",
      mockDeps
    );

    const validNodeId = context.createNodeId();
    expect(context.isValidNodeId(validNodeId)).toBe(true);

    // Invalid formats
    expect(context.isValidNodeId("invalid")).toBe(false);
    expect(context.isValidNodeId("h12345-e01-mmemb-123-abc")).toBe(false); // wrong prefix
    expect(context.isValidNodeId("g12345-e02-mmemb-123-abc")).toBe(false); // wrong epoch
    expect(context.isValidNodeId("g-e-m-t-r")).toBe(false); // too short
  });

  test("extracts member from NodeId", () => {
    const group = createTestGroup();
    const context = new GroupSecurityContext(
      group,
      "member123",
      "member",
      mockDeps
    );

    const nodeId = context.createNodeId();
    const extractedMember = context.getMemberFromNodeId(nodeId);
    expect(extractedMember).toBe("memb"); // First 4 chars of member123

    // Invalid NodeId returns null
    expect(context.getMemberFromNodeId("invalid")).toBe(null);
  });

  test("checks permissions correctly", () => {
    const group = createTestGroup();
    
    const adminContext = new GroupSecurityContext(
      group,
      "admin123",
      "admin",
      mockDeps
    );
    
    const memberContext = new GroupSecurityContext(
      group,
      "member123",
      "member",
      mockDeps
    );

    // Admin has all permissions
    expect(adminContext.hasPermission("admin")).toBe(true);
    expect(adminContext.hasPermission("member")).toBe(true);

    // Member only has member permissions
    expect(memberContext.hasPermission("admin")).toBe(false);
    expect(memberContext.hasPermission("member")).toBe(true);
  });

  test("creates consistent context IDs", () => {
    const groupId = createIdFromString<"Group">("test-group-12345678") as GroupId;
    
    const contextId1 = GroupSecurityContext.createContextId(groupId, 1);
    const contextId2 = GroupSecurityContext.createContextId(groupId, 1);
    const contextId3 = GroupSecurityContext.createContextId(groupId, 2);

    // Same group and epoch should produce same context ID
    expect(contextId1).toBe(contextId2);
    
    // Different epoch should produce different context ID
    expect(contextId1).not.toBe(contextId3);
  });

  test("handles different epochs correctly", () => {
    const group = createTestGroup();
    
    const epoch1Context = new GroupSecurityContext(
      { ...group, currentEpoch: 1 },
      "member123",
      "admin",
      mockDeps
    );
    
    const epoch2Context = new GroupSecurityContext(
      { ...group, currentEpoch: 2 },
      "member123",
      "admin",
      mockDeps
    );

    // Different partition keys for different epochs
    expect(epoch1Context.getPartitionKey()).toBe(`group:${group.id}:1`);
    expect(epoch2Context.getPartitionKey()).toBe(`group:${group.id}:2`);

    // NodeIds from different epochs shouldn't validate across contexts
    const epoch1NodeId = epoch1Context.createNodeId();
    const epoch2NodeId = epoch2Context.createNodeId();
    
    expect(epoch1Context.isValidNodeId(epoch1NodeId)).toBe(true);
    expect(epoch1Context.isValidNodeId(epoch2NodeId)).toBe(false);
    expect(epoch2Context.isValidNodeId(epoch2NodeId)).toBe(true);
    expect(epoch2Context.isValidNodeId(epoch1NodeId)).toBe(false);
  });

  test("toString provides useful debug information", () => {
    const group = createTestGroup();
    const context = new GroupSecurityContext(
      group,
      "member123",
      "admin",
      mockDeps
    );

    const str = context.toString();
    expect(str).toContain("Test Group");
    expect(str).toContain("epoch=1");
    expect(str).toContain("member123");
    expect(str).toContain("admin");
  });
});