import { describe, expect, test } from "vitest";
import {
  ProtocolAuthAdapter,
  createStorageAdapter,
  writeKeyToAuthProof,
  authProofToWriteKey,
} from "../../src/Evolu/ProtocolAbstractions.js";
import type { 
  AuthProvider,
  AuthProof,
  BinaryData,
} from "../../src/Evolu/SecurityAbstractions.js";
import type { WriteKey } from "../../src/Evolu/Owner.js";
import type { Storage as BaseStorage } from "../../src/Evolu/Protocol.js";
import type { NonNegativeInt } from "../../src/Type.js";

// Mock AuthProvider for testing
const createMockAuthProvider = (
  validProof: AuthProof = { type: "test", data: new Uint8Array([1, 2, 3]) }
): AuthProvider => ({
  createAuthProof: async (message: BinaryData) => validProof,
  verifyAuthProof: async (message: BinaryData, proof: AuthProof) => 
    proof.type === validProof.type &&
    JSON.stringify(proof.data) === JSON.stringify(validProof.data),
  getPublicIdentifier: () => "test:identifier",
});

// Mock Storage for testing
const createMockStorage = (
  writeKeyValid = true,
  setWriteKeySuccess = true
): BaseStorage => ({
  getSize: () => 100 as NonNegativeInt,
  fingerprint: () => null,
  fingerprintRanges: () => null,
  findLowerBound: () => null,
  iterate: () => {},
  validateWriteKey: (ownerId, writeKey) => writeKeyValid,
  setWriteKey: (ownerId, writeKey) => setWriteKeySuccess,
  writeMessages: () => true,
  readDbChange: () => null,
  deleteOwner: () => true,
});

describe("ProtocolAbstractions", () => {
  describe("ProtocolAuthAdapter", () => {
    test("creates auth proof using AuthProvider", async () => {
      const authProvider = createMockAuthProvider();
      const adapter = new ProtocolAuthAdapter(authProvider);
      
      const message = new Uint8Array([1, 2, 3]);
      const proof = await adapter.createProtocolAuth(message);
      
      expect(proof.type).toBe("test");
      expect(proof.data).toEqual(new Uint8Array([1, 2, 3]));
    });

    test("verifies auth proof using AuthProvider", async () => {
      const validProof = { type: "test", data: new Uint8Array([4, 5, 6]) };
      const authProvider = createMockAuthProvider(validProof);
      const adapter = new ProtocolAuthAdapter(authProvider);
      
      const message = new Uint8Array([1, 2, 3]);
      const isValid = await adapter.verifyProtocolAuth(message, validProof);
      const isInvalid = await adapter.verifyProtocolAuth(message, { type: "wrong", data: new Uint8Array() });
      
      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    test("handles legacy WriteKey verification", async () => {
      const authProvider = createMockAuthProvider();
      const writeKey = new Uint8Array([7, 8, 9]) as WriteKey;
      const adapter = new ProtocolAuthAdapter(authProvider, writeKey);
      
      const message = new Uint8Array([1, 2, 3]);
      const validProof = { type: "owner-writekey", data: writeKey };
      const invalidProof = { type: "owner-writekey", data: new Uint8Array([1, 2, 3]) };
      
      expect(await adapter.verifyProtocolAuth(message, validProof)).toBe(true);
      expect(await adapter.verifyProtocolAuth(message, invalidProof)).toBe(false);
    });

    test("returns legacy WriteKey when available", () => {
      const authProvider = createMockAuthProvider();
      const writeKey = new Uint8Array([7, 8, 9]) as WriteKey;
      const adapter = new ProtocolAuthAdapter(authProvider, writeKey);
      
      expect(adapter.getLegacyWriteKey()).toBe(writeKey);
    });

    test("returns undefined when no legacy WriteKey", () => {
      const authProvider = createMockAuthProvider();
      const adapter = new ProtocolAuthAdapter(authProvider);
      
      expect(adapter.getLegacyWriteKey()).toBeUndefined();
    });

    test("hasWriteAccess depends on legacy WriteKey", () => {
      const authProvider = createMockAuthProvider();
      const adapterWithKey = new ProtocolAuthAdapter(
        authProvider,
        new Uint8Array([1, 2, 3]) as WriteKey
      );
      const adapterWithoutKey = new ProtocolAuthAdapter(authProvider);
      
      expect(adapterWithKey.hasWriteAccess()).toBe(true);
      expect(adapterWithoutKey.hasWriteAccess()).toBe(false);
    });
  });

  describe("createStorageAdapter", () => {
    test("returns storage as-is if it already supports new methods", async () => {
      const storage = {
        ...createMockStorage(),
        validateAuthProof: async () => true,
        setAuthMaterial: async () => true,
      };
      
      const adapted = createStorageAdapter(storage);
      expect(adapted).toBe(storage);
    });

    test("adapts validateWriteKey to validateAuthProof for WriteKey proofs", async () => {
      const storage = createMockStorage(true);
      const adapted = createStorageAdapter(storage);
      
      const writeKey = new Uint8Array([1, 2, 3]) as WriteKey;
      const proof = { type: "owner-writekey", data: writeKey };
      const message = new Uint8Array([4, 5, 6]);
      
      const result = await adapted.validateAuthProof!(
        new Uint8Array() as any, // BinaryOwnerId
        proof,
        message
      );
      
      expect(result).toBe(true);
    });

    test("uses AuthProvider for non-WriteKey proofs", async () => {
      const storage = createMockStorage();
      const authProvider = createMockAuthProvider();
      const adapted = createStorageAdapter(storage, authProvider);
      
      const proof = { type: "test", data: new Uint8Array([1, 2, 3]) };
      const message = new Uint8Array([4, 5, 6]);
      
      const result = await adapted.validateAuthProof!(
        new Uint8Array() as any,
        proof,
        message
      );
      
      expect(result).toBe(true);
    });

    test("adapts setWriteKey to setAuthMaterial for WriteKey", async () => {
      const storage = createMockStorage(true, true);
      const adapted = createStorageAdapter(storage);
      
      const writeKey = new Uint8Array([1, 2, 3]) as WriteKey;
      const material = { type: "owner-writekey", data: writeKey };
      
      const result = await adapted.setAuthMaterial!(
        new Uint8Array() as any,
        material
      );
      
      expect(result).toBe(true);
    });
  });

  describe("helper functions", () => {
    test("writeKeyToAuthProof converts WriteKey to AuthProof", () => {
      const writeKey = new Uint8Array([1, 2, 3, 4]) as WriteKey;
      const proof = writeKeyToAuthProof(writeKey);
      
      expect(proof.type).toBe("owner-writekey");
      expect(proof.data).toBe(writeKey);
    });

    test("authProofToWriteKey extracts WriteKey from compatible proof", () => {
      const writeKey = new Uint8Array([5, 6, 7, 8]) as WriteKey;
      const proof = { type: "owner-writekey", data: writeKey };
      
      expect(authProofToWriteKey(proof)).toBe(writeKey);
    });

    test("authProofToWriteKey returns null for incompatible proof", () => {
      const proof = { type: "other", data: new Uint8Array([1, 2, 3]) };
      
      expect(authProofToWriteKey(proof)).toBeNull();
    });
  });
});