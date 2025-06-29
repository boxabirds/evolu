import { expect, test, describe } from "vitest";
import {
  createGroupAuthProvider,
  type GroupMember,
} from "../src/Evolu/GroupAuthProvider.js";

describe("GroupAuthProvider", () => {
  const createTestMember = (userId: string, role: "admin" | "member"): GroupMember => ({
    userId,
    role,
    publicKey: new Uint8Array(32).fill(1), // Dummy key for testing
    joinedAt: new Date().toISOString(),
  });
  
  test("initializes with members", () => {
    const members = [
      createTestMember("user1", "admin"),
      createTestMember("user2", "member"),
    ];
    
    const provider = createGroupAuthProvider("group123", "user1", members);
    
    expect(provider.groupId).toBe("group123");
    expect(provider.members.length).toBe(2);
  });
  
  test("creates auth proof for members", async () => {
    const members = [createTestMember("user1", "admin")];
    const provider = createGroupAuthProvider("group123", "user1", members);
    
    const message = new TextEncoder().encode("test message");
    const proof = await provider.createAuthProof(message);
    
    expect(proof.type).toBe("group-signature");
    expect(proof.data).toBeInstanceOf(Uint8Array);
    expect(proof.data.length).toBeGreaterThan(32); // Hash + metadata
    
    // Extract and verify metadata from proof data
    const metadataBytes = proof.data.slice(32);
    const metadataString = new TextDecoder().decode(metadataBytes);
    const metadata = JSON.parse(metadataString);
    
    expect(metadata).toMatchObject({
      groupId: "group123",
      userId: "user1",
      role: "admin",
    });
  });
  
  test("throws when non-member tries to create proof", async () => {
    const members = [createTestMember("user1", "admin")];
    const provider = createGroupAuthProvider("group123", "user2", members);
    
    const message = new TextEncoder().encode("test message");
    await expect(provider.createAuthProof(message)).rejects.toThrow(
      "User user2 is not a member of group group123"
    );
  });
  
  test("verifies valid auth proof", async () => {
    const members = [createTestMember("user1", "admin")];
    const provider = createGroupAuthProvider("group123", "user1", members);
    
    const message = new TextEncoder().encode("test message");
    const proof = await provider.createAuthProof(message);
    
    const isValid = await provider.verifyAuthProof(message, proof);
    expect(isValid).toBe(true);
  });
  
  test("rejects invalid auth proof", async () => {
    const members = [createTestMember("user1", "admin")];
    const provider = createGroupAuthProvider("group123", "user1", members);
    
    const message = new TextEncoder().encode("test message");
    const proof = await provider.createAuthProof(message);
    
    // Try to verify with different message
    const differentMessage = new TextEncoder().encode("different message");
    const isValid = await provider.verifyAuthProof(differentMessage, proof);
    expect(isValid).toBe(false);
  });
  
  test("manages members", () => {
    const provider = createGroupAuthProvider("group123", "user1");
    
    expect(provider.members.length).toBe(0);
    
    // Add member
    const member = createTestMember("user1", "admin");
    provider.addMember(member);
    expect(provider.members.length).toBe(1);
    expect(provider.getMemberRole("user1")).toBe("admin");
    
    // Add another member
    const member2 = createTestMember("user2", "member");
    provider.addMember(member2);
    expect(provider.members.length).toBe(2);
    
    // Remove member
    provider.removeMember("user2");
    expect(provider.members.length).toBe(1);
    expect(provider.getMemberRole("user2")).toBeNull();
  });
  
  test("checks permissions correctly", () => {
    const members = [
      createTestMember("admin1", "admin"),
      createTestMember("member1", "member"),
    ];
    const provider = createGroupAuthProvider("group123", "admin1", members);
    
    // Admin can do everything
    expect(provider.canPerformAction("admin1", "addMember")).toBe(true);
    expect(provider.canPerformAction("admin1", "read")).toBe(true);
    expect(provider.canPerformAction("admin1", "write")).toBe(true);
    expect(provider.canPerformAction("admin1", "deleteGroup")).toBe(true);
    
    // Member has limited permissions
    expect(provider.canPerformAction("member1", "read")).toBe(true);
    expect(provider.canPerformAction("member1", "write")).toBe(true);
    expect(provider.canPerformAction("member1", "invite")).toBe(true);
    expect(provider.canPerformAction("member1", "addMember")).toBe(false);
    expect(provider.canPerformAction("member1", "deleteGroup")).toBe(false);
    
    // Non-member has no permissions
    expect(provider.canPerformAction("stranger", "read")).toBe(false);
  });
});