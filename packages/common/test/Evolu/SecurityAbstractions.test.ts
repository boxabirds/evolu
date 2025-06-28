import { describe, expect, test } from "vitest";
import {
  type SecurityContext,
  type AuthProvider,
  type EncryptionProvider,
  type PartitionStrategy,
  type AuthProof,
  type BinaryData,
  type EncryptedData,
  success,
  failure,
  isSuccess,
  isFailure,
} from "../../src/Evolu/SecurityAbstractions.js";
import type { NodeId } from "../../src/Evolu/Timestamp.js";

describe("SecurityAbstractions", () => {
  describe("Result helpers", () => {
    test("success creates successful result", () => {
      const result = success("test value");
      expect(result.success).toBe(true);
      expect((result as any).value).toBe("test value");
    });

    test("failure creates failure result", () => {
      const error = new Error("test error");
      const result = failure<string>(error);
      expect(result.success).toBe(false);
      expect((result as any).error).toBe(error);
    });

    test("isSuccess type guard works correctly", () => {
      const successResult = success("test");
      const failureResult = failure<string>(new Error());
      
      expect(isSuccess(successResult)).toBe(true);
      expect(isSuccess(failureResult)).toBe(false);
    });

    test("isFailure type guard works correctly", () => {
      const successResult = success("test");
      const failureResult = failure<string>(new Error());
      
      expect(isFailure(successResult)).toBe(false);
      expect(isFailure(failureResult)).toBe(true);
    });
  });

  describe("Interface contracts", () => {
    test("SecurityContext interface", () => {
      const mockContext: SecurityContext = {
        id: "test-context",
        type: "test",
        createNodeId: () => "0000000000000000" as NodeId,
        getPartitionKey: () => "test-partition",
        metadata: { custom: "data" },
      };

      expect(mockContext.id).toBe("test-context");
      expect(mockContext.type).toBe("test");
      expect(mockContext.createNodeId()).toBe("0000000000000000");
      expect(mockContext.getPartitionKey()).toBe("test-partition");
      expect(mockContext.metadata?.custom).toBe("data");
    });

    test("AuthProvider interface", async () => {
      const mockAuthProvider: AuthProvider = {
        createAuthProof: async (message: BinaryData) => ({
          type: "mock",
          data: new Uint8Array([1, 2, 3]),
        }),
        verifyAuthProof: async (message: BinaryData, proof: AuthProof) => 
          proof.type === "mock",
        getPublicIdentifier: () => "mock:public-id",
      };

      const message = new Uint8Array([4, 5, 6]);
      const proof = await mockAuthProvider.createAuthProof(message);
      
      expect(proof.type).toBe("mock");
      expect(proof.data).toEqual(new Uint8Array([1, 2, 3]));
      expect(await mockAuthProvider.verifyAuthProof(message, proof)).toBe(true);
      expect(mockAuthProvider.getPublicIdentifier()).toBe("mock:public-id");
    });

    test("EncryptionProvider interface", async () => {
      const mockEncryptionProvider: EncryptionProvider = {
        encrypt: async (plaintext: BinaryData, context: SecurityContext) => ({
          contextId: context.id,
          ciphertext: new Uint8Array([...plaintext, 99]), // Mock encryption
          metadata: { encrypted: true },
        }),
        decrypt: async (encrypted: EncryptedData, context: SecurityContext) => {
          if (encrypted.contextId !== context.id) {
            throw new Error("Context mismatch");
          }
          // Mock decryption - remove last byte
          return encrypted.ciphertext.slice(0, -1);
        },
        canDecrypt: (encrypted: EncryptedData, context: SecurityContext) =>
          encrypted.contextId === context.id,
      };

      const context: SecurityContext = {
        id: "test",
        type: "test",
        createNodeId: () => "0000000000000000" as NodeId,
        getPartitionKey: () => "test",
      };

      const plaintext = new Uint8Array([1, 2, 3]);
      const encrypted = await mockEncryptionProvider.encrypt(plaintext, context);
      
      expect(encrypted.contextId).toBe("test");
      expect(encrypted.ciphertext).toEqual(new Uint8Array([1, 2, 3, 99]));
      expect(encrypted.metadata?.encrypted).toBe(true);
      
      const decrypted = await mockEncryptionProvider.decrypt(encrypted, context);
      expect(decrypted).toEqual(plaintext);
      
      expect(mockEncryptionProvider.canDecrypt(encrypted, context)).toBe(true);
    });

    test("PartitionStrategy interface", () => {
      const mockPartitionStrategy: PartitionStrategy = {
        shouldSync: (local: SecurityContext, remote: SecurityContext) =>
          local.getPartitionKey() === remote.getPartitionKey(),
        canAccess: (context: SecurityContext, data: EncryptedData) =>
          data.contextId === context.id,
        filterSyncTargets: (local: SecurityContext, contexts: ReadonlyArray<SecurityContext>) =>
          contexts.filter(ctx => ctx.getPartitionKey() === local.getPartitionKey()),
      };

      const context1: SecurityContext = {
        id: "ctx1",
        type: "test",
        createNodeId: () => "0000000000000001" as NodeId,
        getPartitionKey: () => "partition-a",
      };

      const context2: SecurityContext = {
        id: "ctx2",
        type: "test",
        createNodeId: () => "0000000000000002" as NodeId,
        getPartitionKey: () => "partition-a",
      };

      const context3: SecurityContext = {
        id: "ctx3",
        type: "test",
        createNodeId: () => "0000000000000003" as NodeId,
        getPartitionKey: () => "partition-b",
      };

      expect(mockPartitionStrategy.shouldSync(context1, context2)).toBe(true);
      expect(mockPartitionStrategy.shouldSync(context1, context3)).toBe(false);

      const data: EncryptedData = {
        contextId: "ctx1",
        ciphertext: new Uint8Array(),
      };
      expect(mockPartitionStrategy.canAccess(context1, data)).toBe(true);
      expect(mockPartitionStrategy.canAccess(context2, data)).toBe(false);

      const filtered = mockPartitionStrategy.filterSyncTargets(context1, [context1, context2, context3]);
      expect(filtered).toEqual([context1, context2]);
    });
  });
});