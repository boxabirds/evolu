import { expect, test, describe } from "vitest";
import {
  GroupEncryptionProvider,
  createGroupEncryptionProvider,
} from "../src/Evolu/GroupEncryptionProvider.js";
import { GroupId, EpochKeyId } from "../src/Evolu/GroupTypes.js";
import { createIdFromString } from "../src/Type.js";
import type { SecurityContext } from "../src/Evolu/SecurityAbstractions.js";

describe("GroupEncryptionProvider", () => {
  const createTestGroupId = () => 
    createIdFromString<"Group">("test-group-123") as GroupId;

  const createTestContext = (id: string = "test-context"): SecurityContext => ({
    id,
    type: "group",
    createNodeId: () => "test-node-id",
    getPartitionKey: () => "test-partition",
    metadata: { test: true },
  });

  test("creates provider with group ID and epoch", () => {
    const groupId = createTestGroupId();
    const provider = new GroupEncryptionProvider(groupId, 1);
    
    expect(provider.getCurrentEpoch()).toBe(1);
  });

  test("encrypts data with metadata (Phase 1 pass-through)", async () => {
    const groupId = createTestGroupId();
    const provider = new GroupEncryptionProvider(groupId, 1);
    const context = createTestContext();
    
    const plaintext = new TextEncoder().encode("test data");
    const encrypted = await provider.encrypt(plaintext, context);
    
    expect(encrypted.contextId).toBe(context.id);
    expect(encrypted.ciphertext).toBe(plaintext); // Phase 1: no encryption
    expect(encrypted.metadata).toMatchObject({
      groupId: String(groupId),
      epoch: 1,
      encrypted: false, // Phase 1 marker
    });
    expect(encrypted.metadata?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("decrypts Phase 1 data (pass-through)", async () => {
    const groupId = createTestGroupId();
    const provider = new GroupEncryptionProvider(groupId, 1);
    const context = createTestContext();
    
    const plaintext = new TextEncoder().encode("test data");
    const encrypted = await provider.encrypt(plaintext, context);
    const decrypted = await provider.decrypt(encrypted, context);
    
    expect(decrypted).toBe(plaintext);
  });

  test("throws on decrypt without metadata", async () => {
    const groupId = createTestGroupId();
    const provider = new GroupEncryptionProvider(groupId, 1);
    const context = createTestContext();
    
    const invalidEncrypted = {
      contextId: "test",
      ciphertext: new Uint8Array(10),
      // Missing metadata
    };
    
    await expect(
      provider.decrypt(invalidEncrypted, context)
    ).rejects.toThrow("Missing encryption metadata");
  });

  test("throws on decrypt with wrong group ID", async () => {
    const groupId1 = createTestGroupId();
    const groupId2 = createIdFromString<"Group">("different-group") as GroupId;
    
    const provider1 = new GroupEncryptionProvider(groupId1, 1);
    const provider2 = new GroupEncryptionProvider(groupId2, 1);
    const context = createTestContext();
    
    const plaintext = new TextEncoder().encode("test data");
    const encrypted = await provider1.encrypt(plaintext, context);
    
    await expect(
      provider2.decrypt(encrypted, context)
    ).rejects.toThrow(/Mismatched group ID/);
  });

  test("throws on decrypt with wrong epoch", async () => {
    const groupId = createTestGroupId();
    const provider = new GroupEncryptionProvider(groupId, 2);
    const context = createTestContext();
    
    // Create encrypted data claiming to be from epoch 1
    const encryptedData = {
      contextId: context.id,
      ciphertext: new Uint8Array(10),
      metadata: {
        groupId: String(groupId),
        epoch: 1,
        encrypted: true, // Not Phase 1 data
      },
    };
    
    await expect(
      provider.decrypt(encryptedData, context)
    ).rejects.toThrow(/Cannot decrypt data from epoch 1 with current epoch 2/);
  });

  test("canDecrypt returns true for same group and epoch", () => {
    const groupId = createTestGroupId();
    const provider = new GroupEncryptionProvider(groupId, 1);
    const context = createTestContext();
    
    const encryptedData = {
      contextId: context.id,
      ciphertext: new Uint8Array(10),
      metadata: {
        groupId: String(groupId),
        epoch: 1,
        encrypted: false,
      },
    };
    
    expect(provider.canDecrypt(encryptedData, context)).toBe(true);
  });

  test("canDecrypt returns false for different group", () => {
    const groupId1 = createTestGroupId();
    const groupId2 = createIdFromString<"Group">("different-group") as GroupId;
    
    const provider = new GroupEncryptionProvider(groupId1, 1);
    const context = createTestContext();
    
    const encryptedData = {
      contextId: context.id,
      ciphertext: new Uint8Array(10),
      metadata: {
        groupId: String(groupId2),
        epoch: 1,
        encrypted: false,
      },
    };
    
    expect(provider.canDecrypt(encryptedData, context)).toBe(false);
  });

  test("canDecrypt returns false for different epoch", () => {
    const groupId = createTestGroupId();
    const provider = new GroupEncryptionProvider(groupId, 2);
    const context = createTestContext();
    
    const encryptedData = {
      contextId: context.id,
      ciphertext: new Uint8Array(10),
      metadata: {
        groupId: String(groupId),
        epoch: 1,
        encrypted: true, // Not Phase 1 data
      },
    };
    
    expect(provider.canDecrypt(encryptedData, context)).toBe(false);
  });

  test("canDecrypt returns false for missing metadata", () => {
    const groupId = createTestGroupId();
    const provider = new GroupEncryptionProvider(groupId, 1);
    const context = createTestContext();
    
    const encryptedData = {
      contextId: context.id,
      ciphertext: new Uint8Array(10),
      // Missing metadata
    };
    
    expect(provider.canDecrypt(encryptedData, context)).toBe(false);
  });

  test("updateEpoch updates the current epoch", () => {
    const groupId = createTestGroupId();
    const provider = new GroupEncryptionProvider(groupId, 1);
    
    expect(provider.getCurrentEpoch()).toBe(1);
    
    provider.updateEpoch(2);
    expect(provider.getCurrentEpoch()).toBe(2);
    
    const epochKeyId = createIdFromString<"EpochKey">("key-123") as EpochKeyId;
    provider.updateEpoch(3, epochKeyId);
    expect(provider.getCurrentEpoch()).toBe(3);
  });

  test("factory function creates provider", () => {
    const groupId = createTestGroupId();
    const provider = createGroupEncryptionProvider(groupId, 1);
    
    expect(provider).toBeInstanceOf(GroupEncryptionProvider);
    expect(provider.getCurrentEpoch()).toBe(1);
  });

  test("factory function accepts options", () => {
    const groupId = createTestGroupId();
    const epochKeyId = createIdFromString<"EpochKey">("key-123") as EpochKeyId;
    
    const provider = createGroupEncryptionProvider(groupId, 1, {
      epochKeyId,
      keyStore: { test: true }, // Phase 2
    });
    
    expect(provider).toBeInstanceOf(GroupEncryptionProvider);
    expect(provider.getCurrentEpoch()).toBe(1);
  });

  test("handles round-trip encryption/decryption", async () => {
    const groupId = createTestGroupId();
    const provider = new GroupEncryptionProvider(groupId, 1);
    const context = createTestContext();
    
    // Test with various data types
    const testData = [
      new TextEncoder().encode("Hello, World!"),
      new Uint8Array([1, 2, 3, 4, 5]),
      new Uint8Array(0), // Empty array
      new Uint8Array(1000).fill(42), // Large array
    ];
    
    for (const data of testData) {
      const encrypted = await provider.encrypt(data, context);
      const decrypted = await provider.decrypt(encrypted, context);
      
      expect(decrypted).toBe(data); // Phase 1: same reference
      expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(data));
    }
  });
});