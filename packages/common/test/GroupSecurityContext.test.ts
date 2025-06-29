import { expect, test, describe } from "vitest";
import {
  createGroupSecurityContext,
  createGroup,
  type Group,
} from "../src/Evolu/GroupSecurityContext.js";
import { createEpochManager } from "../src/Evolu/EpochManager.js";

describe("GroupSecurityContext", () => {
  test("creates a valid security context", () => {
    const group = createGroup("Test Group", "user123");
    const epochManager = createEpochManager(group.id);
    const context = createGroupSecurityContext(group, epochManager);
    
    expect(context.type).toBe("group");
    expect(context.id).toBe(group.id);
    expect(context.group).toBe(group);
    expect(context.epochManager).toBe(epochManager);
  });
  
  test("generates valid NodeIds", () => {
    const group = createGroup("Test Group", "user123");
    const epochManager = createEpochManager(group.id);
    const context = createGroupSecurityContext(group, epochManager);
    
    const nodeId1 = context.createNodeId();
    const nodeId2 = context.createNodeId();
    
    // NodeIds should be 16 characters
    expect(nodeId1.length).toBe(16);
    expect(nodeId2.length).toBe(16);
    
    // NodeIds should be unique
    expect(nodeId1).not.toBe(nodeId2);
    
    // NodeIds should be valid hex strings
    expect(/^[0-9a-f]+$/.test(nodeId1)).toBe(true);
    expect(/^[0-9a-f]+$/.test(nodeId2)).toBe(true);
  });
  
  test("generates correct partition keys", () => {
    const group = createGroup("Test Group", "user123");
    const epochManager = createEpochManager(group.id);
    const context = createGroupSecurityContext(group, epochManager);
    
    const partitionKey = context.getPartitionKey();
    expect(partitionKey).toBe(`group:${group.id}:1`);
    
    // After epoch increment
    epochManager.incrementEpoch();
    const newContext = createGroupSecurityContext(group, epochManager);
    const newPartitionKey = newContext.getPartitionKey();
    expect(newPartitionKey).toBe(`group:${group.id}:2`);
  });
  
  test("includes metadata", () => {
    const group = createGroup("Test Group", "user123");
    const epochManager = createEpochManager(group.id);
    const context = createGroupSecurityContext(group, epochManager);
    
    expect(context.metadata).toEqual({
      groupName: "Test Group",
      epoch: 1,
      createdBy: "user123",
    });
  });
  
  test("createGroup generates valid groups", () => {
    const group = createGroup("My Team", "owner456");
    
    expect(group.name).toBe("My Team");
    expect(group.createdBy).toBe("owner456");
    expect(group.currentEpoch).toBe(1);
    expect(group.id.length).toBe(16);
    expect(group.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});