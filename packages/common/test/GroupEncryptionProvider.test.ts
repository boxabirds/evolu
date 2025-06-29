import { expect, test, describe } from "vitest";
import { createGroupEncryptionProvider } from "../src/Evolu/GroupEncryptionProvider.js";
import { createEpochManager } from "../src/Evolu/EpochManager.js";

describe("GroupEncryptionProvider", () => {
  test("passes through data in Phase 1", async () => {
    const epochManager = createEpochManager("group123");
    const provider = createGroupEncryptionProvider("group123", epochManager);
    
    const data = new TextEncoder().encode("test data");
    const context = { type: "group", id: "group123" };
    
    const encrypted = await provider.encrypt(data, context);
    expect(encrypted).toBe(data); // Phase 1: no encryption
    
    const decrypted = await provider.decrypt(encrypted, context);
    expect(decrypted).toBe(data); // Phase 1: no decryption
  });
  
  test("validates context matches group", async () => {
    const epochManager = createEpochManager("group123");
    const provider = createGroupEncryptionProvider("group123", epochManager);
    
    const data = new TextEncoder().encode("test data");
    const wrongContext = { type: "group", id: "wronggroup" };
    
    await expect(provider.encrypt(data, wrongContext)).rejects.toThrow(
      "GroupEncryptionProvider can only handle group group123"
    );
    
    await expect(provider.decrypt(data, wrongContext)).rejects.toThrow(
      "GroupEncryptionProvider can only handle group group123"
    );
  });
  
  test("rejects non-group contexts", async () => {
    const epochManager = createEpochManager("group123");
    const provider = createGroupEncryptionProvider("group123", epochManager);
    
    const data = new TextEncoder().encode("test data");
    const ownerContext = { type: "owner", id: "owner123" };
    
    await expect(provider.encrypt(data, ownerContext)).rejects.toThrow(
      "GroupEncryptionProvider can only handle group group123"
    );
  });
  
  test("works with different epoch managers", async () => {
    const epochManager1 = createEpochManager("group123", 1);
    const epochManager2 = createEpochManager("group123", 5);
    
    const provider1 = createGroupEncryptionProvider("group123", epochManager1);
    const provider2 = createGroupEncryptionProvider("group123", epochManager2);
    
    const data = new TextEncoder().encode("test data");
    const context = { type: "group", id: "group123" };
    
    // Both should work (Phase 1: no actual encryption)
    const encrypted1 = await provider1.encrypt(data, context);
    const encrypted2 = await provider2.encrypt(data, context);
    
    expect(encrypted1).toBe(data);
    expect(encrypted2).toBe(data);
  });
});