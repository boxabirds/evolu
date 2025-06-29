import { expect, test, describe } from "vitest";
import { GroupAuthProvider } from "../src/Evolu/GroupAuthProvider.js";
import { GroupId, MemberId, GroupMember } from "../src/Evolu/GroupTypes.js";
import { createIdFromString } from "../src/Type.js";
import type { SymmetricCrypto } from "../src/Crypto.js";

describe("GroupAuthProvider", () => {
  // Mock crypto for testing - Phase 1 doesn't use actual crypto
  const mockCrypto: SymmetricCrypto = {
    encrypt: (data: Uint8Array, key: Uint8Array) => ({ 
      ciphertext: data, 
      nonce: new Uint8Array(12) 
    }),
    decrypt: (ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array) => ({ 
      ok: true, 
      value: ciphertext 
    }),
    nonceLength: 12,
  };

  const createTestMember = (
    userId: string,
    role: "admin" | "member"
  ): GroupMember => ({
    id: createIdFromString<"Member">(`member-${userId}`) as MemberId,
    userId,
    groupId: createIdFromString<"Group">("test-group") as GroupId,
    role,
    publicKey: btoa(String.fromCharCode(...new Uint8Array(32).fill(1))),
    joinedAt: new Date("2024-01-01"),
    leftAt: undefined,
  });

  const createTestProvider = (
    currentUserId: string = "user1",
    members?: GroupMember[]
  ) => {
    const groupId = createIdFromString<"Group">("test-group") as GroupId;
    const allMembers = members || [
      createTestMember("user1", "admin"),
      createTestMember("user2", "member"),
      createTestMember("user3", "member"),
    ];
    
    const currentMember = allMembers.find(m => m.userId === currentUserId);
    if (!currentMember) {
      throw new Error(`Current user ${currentUserId} not in members`);
    }

    return new GroupAuthProvider(
      groupId,
      currentMember,
      allMembers,
      1, // epoch
      mockCrypto
    );
  };

  test("creates valid auth provider", () => {
    const provider = createTestProvider();
    
    expect(provider.getPublicIdentifier()).toBe(`group:${createIdFromString("test-group")}:1`);
    expect(provider.isMember("user1")).toBe(true);
    expect(provider.isMember("user2")).toBe(true);
    expect(provider.isMember("nonexistent")).toBe(false);
  });

  test("throws when current member not in group", () => {
    const members = [createTestMember("user1", "admin")];
    const groupId = createIdFromString<"Group">("test-group") as GroupId;
    const nonMember = createTestMember("outsider", "member");

    expect(() => {
      new GroupAuthProvider(groupId, nonMember, members, 1, mockCrypto);
    }).toThrow("Current member outsider is not in group");
  });

  test("creates auth proof successfully", async () => {
    const provider = createTestProvider();
    const message = new TextEncoder().encode("test message");
    
    const proof = await provider.createAuthProof(message);
    
    expect(proof.type).toBe("group-auth-v1");
    expect(proof.data).toBeInstanceOf(Uint8Array);
    expect(proof.data.length).toBeGreaterThan(36); // 4 bytes length + 32 bytes hash + metadata
    
    // Parse the proof to verify structure
    const view = new DataView(proof.data.buffer);
    const signatureLength = view.getUint32(0, true);
    expect(signatureLength).toBe(32); // SHA-256 produces 32 bytes
    
    const metadataBytes = proof.data.slice(4 + signatureLength);
    const metadataString = new TextDecoder().decode(metadataBytes);
    const metadata = JSON.parse(metadataString);
    
    expect(metadata).toMatchObject({
      groupId: createIdFromString("test-group"),
      memberId: expect.any(String),
      role: "admin",
      epoch: 1,
    });
    expect(metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("verifies valid auth proof", async () => {
    const provider = createTestProvider();
    const message = new TextEncoder().encode("test message");
    
    const proof = await provider.createAuthProof(message);
    const isValid = await provider.verifyAuthProof(message, proof);
    
    expect(isValid).toBe(true);
  });

  test("rejects proof with wrong message", async () => {
    const provider = createTestProvider();
    const message = new TextEncoder().encode("test message");
    const wrongMessage = new TextEncoder().encode("wrong message");
    
    const proof = await provider.createAuthProof(message);
    const isValid = await provider.verifyAuthProof(wrongMessage, proof);
    
    expect(isValid).toBe(false);
  });

  test("rejects proof from different group", async () => {
    const provider1 = createTestProvider();
    const message = new TextEncoder().encode("test message");
    
    // Create proof with provider1
    const proof = await provider1.createAuthProof(message);
    
    // Try to verify with provider2 (different group)
    const groupId2 = createIdFromString<"Group">("different-group") as GroupId;
    const members = [createTestMember("user1", "admin")];
    const provider2 = new GroupAuthProvider(
      groupId2,
      members[0],
      members,
      1,
      mockCrypto
    );
    
    const isValid = await provider2.verifyAuthProof(message, proof);
    expect(isValid).toBe(false);
  });

  test("rejects proof from different epoch", async () => {
    const members = [
      createTestMember("user1", "admin"),
      createTestMember("user2", "member"),
    ];
    
    const groupId = createIdFromString<"Group">("test-group") as GroupId;
    
    // Create providers with different epochs
    const provider1 = new GroupAuthProvider(
      groupId,
      members[0],
      members,
      1,
      mockCrypto
    );
    
    const provider2 = new GroupAuthProvider(
      groupId,
      members[0],
      members,
      2, // Different epoch
      mockCrypto
    );
    
    const message = new TextEncoder().encode("test message");
    const proof = await provider1.createAuthProof(message);
    
    // Verify with different epoch should fail
    const isValid = await provider2.verifyAuthProof(message, proof);
    expect(isValid).toBe(false);
  });

  test("rejects proof with invalid type", async () => {
    const provider = createTestProvider();
    const message = new TextEncoder().encode("test message");
    
    const invalidProof = {
      type: "invalid-type",
      data: new Uint8Array(100),
    };
    
    const isValid = await provider.verifyAuthProof(message, invalidProof);
    expect(isValid).toBe(false);
  });

  test("rejects malformed proof data", async () => {
    const provider = createTestProvider();
    const message = new TextEncoder().encode("test message");
    
    // Too short data
    const shortProof = {
      type: "group-auth-v1",
      data: new Uint8Array(3), // Too short to contain valid data
    };
    
    const isValid1 = await provider.verifyAuthProof(message, shortProof);
    expect(isValid1).toBe(false);
    
    // Invalid JSON in metadata
    const invalidJsonProof = {
      type: "group-auth-v1",
      data: new Uint8Array(40),
    };
    const view = new DataView(invalidJsonProof.data.buffer);
    view.setUint32(0, 32, true); // signature length
    // Rest is zeros, which is invalid JSON
    
    const isValid2 = await provider.verifyAuthProof(message, invalidJsonProof);
    expect(isValid2).toBe(false);
  });

  test("checks member permissions correctly", () => {
    const provider = createTestProvider("user1"); // Admin
    
    // Admin can do everything
    expect(provider.canPerformAction("user1", "addMember")).toBe(true);
    expect(provider.canPerformAction("user1", "removeMember")).toBe(true);
    expect(provider.canPerformAction("user1", "read")).toBe(true);
    expect(provider.canPerformAction("user1", "write")).toBe(true);
    
    // Regular member can only do member actions
    expect(provider.canPerformAction("user2", "read")).toBe(true);
    expect(provider.canPerformAction("user2", "write")).toBe(true);
    expect(provider.canPerformAction("user2", "addMember")).toBe(false);
    expect(provider.canPerformAction("user2", "removeMember")).toBe(false);
    
    // Non-member can't do anything
    expect(provider.canPerformAction("outsider", "read")).toBe(false);
    expect(provider.canPerformAction("outsider", "write")).toBe(false);
  });

  test("gets member roles correctly", () => {
    const provider = createTestProvider();
    
    expect(provider.getMemberRole("user1")).toBe("admin");
    expect(provider.getMemberRole("user2")).toBe("member");
    expect(provider.getMemberRole("nonexistent")).toBe(null);
  });

  test("returns all members", () => {
    const members = [
      createTestMember("user1", "admin"),
      createTestMember("user2", "member"),
    ];
    
    const groupId = createIdFromString<"Group">("test-group") as GroupId;
    const provider = new GroupAuthProvider(
      groupId,
      members[0],
      members,
      1,
      mockCrypto
    );
    
    const allMembers = provider.getMembers();
    expect(allMembers).toHaveLength(2);
    expect(allMembers[0].userId).toBe("user1");
    expect(allMembers[1].userId).toBe("user2");
  });

  test("verifies proof from member with changed role fails", async () => {
    const members = [createTestMember("user1", "member")]; // Start as member
    const groupId = createIdFromString<"Group">("test-group") as GroupId;
    
    const provider = new GroupAuthProvider(
      groupId,
      members[0],
      members,
      1,
      mockCrypto
    );
    
    const message = new TextEncoder().encode("test message");
    const proof = await provider.createAuthProof(message);
    
    // Now create a new provider where user1 is admin
    const updatedMembers = [createTestMember("user1", "admin")];
    const provider2 = new GroupAuthProvider(
      groupId,
      updatedMembers[0],
      updatedMembers,
      1,
      mockCrypto
    );
    
    // Verification should fail because role in proof doesn't match
    const isValid = await provider2.verifyAuthProof(message, proof);
    expect(isValid).toBe(false);
  });
});