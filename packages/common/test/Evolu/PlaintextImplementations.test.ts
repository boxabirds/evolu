import { describe, expect, test } from "vitest";
import {
  PlaintextSecurityContext,
  PlaintextAuthProvider,
  PlaintextEncryptionProvider,
  GlobalPartitionStrategy,
  PlaintextSecurityFactory,
  createPlaintextSecurity,
  PLAINTEXT_WARNING,
} from "../../src/Evolu/PlaintextImplementations.js";
import type { SecurityContext } from "../../src/Evolu/SecurityAbstractions.js";

describe("PlaintextImplementations", () => {
  describe("PlaintextSecurityContext", () => {
    test("creates context with default id", () => {
      const context = new PlaintextSecurityContext();
      expect(context.id).toBe("plaintext-global");
      expect(context.type).toBe("plaintext");
      expect(context.metadata).toEqual({ warning: "No encryption - development only" });
    });

    test("creates context with custom id", () => {
      const context = new PlaintextSecurityContext("custom-id");
      expect(context.id).toBe("custom-id");
    });

    test("creates valid hex node id", () => {
      const context = new PlaintextSecurityContext("test");
      const nodeId = context.createNodeId();
      
      expect(nodeId).toMatch(/^[a-f0-9]{16}$/);
      expect(nodeId.length).toBe(16);
    });

    test("returns global partition key", () => {
      const context = new PlaintextSecurityContext();
      expect(context.getPartitionKey()).toBe("global");
    });
  });

  describe("PlaintextAuthProvider", () => {
    test("creates plaintext auth proof", async () => {
      const context = new PlaintextSecurityContext("test");
      const authProvider = new PlaintextAuthProvider(context);
      
      const message = new Uint8Array([1, 2, 3]);
      const proof = await authProvider.createAuthProof(message);
      
      expect(proof.type).toBe("plaintext");
      const proofText = new TextDecoder().decode(proof.data);
      expect(proofText).toBe("plaintext-proof-test");
    });

    test("verifies any plaintext proof", async () => {
      const context = new PlaintextSecurityContext();
      const authProvider = new PlaintextAuthProvider(context);
      
      const message = new Uint8Array([1, 2, 3]);
      const validProof = { type: "plaintext", data: new Uint8Array() };
      const invalidProof = { type: "other", data: new Uint8Array() };
      
      expect(await authProvider.verifyAuthProof(message, validProof)).toBe(true);
      expect(await authProvider.verifyAuthProof(message, invalidProof)).toBe(false);
    });

    test("returns plaintext public identifier", () => {
      const context = new PlaintextSecurityContext("test");
      const authProvider = new PlaintextAuthProvider(context);
      
      expect(authProvider.getPublicIdentifier()).toBe("plaintext:test");
    });
  });

  describe("PlaintextEncryptionProvider", () => {
    test("performs no encryption", async () => {
      const encryptionProvider = new PlaintextEncryptionProvider();
      const context = new PlaintextSecurityContext("test");
      
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await encryptionProvider.encrypt(plaintext, context);
      
      expect(encrypted.contextId).toBe("test");
      expect(encrypted.ciphertext).toEqual(plaintext);
      expect(encrypted.metadata).toEqual({
        encrypted: false,
        warning: "Data is not encrypted",
      });
    });

    test("performs no decryption", async () => {
      const encryptionProvider = new PlaintextEncryptionProvider();
      const context = new PlaintextSecurityContext("test");
      
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = {
        contextId: "test",
        ciphertext: data,
        metadata: {},
      };
      
      const decrypted = await encryptionProvider.decrypt(encrypted, context);
      expect(decrypted).toEqual(data);
    });

    test("can decrypt anything", () => {
      const encryptionProvider = new PlaintextEncryptionProvider();
      const context1 = new PlaintextSecurityContext("test1");
      const context2 = new PlaintextSecurityContext("test2");
      
      const encrypted = {
        contextId: "other",
        ciphertext: new Uint8Array(),
      };
      
      expect(encryptionProvider.canDecrypt(encrypted, context1)).toBe(true);
      expect(encryptionProvider.canDecrypt(encrypted, context2)).toBe(true);
    });
  });

  describe("GlobalPartitionStrategy", () => {
    test("allows all contexts to sync", () => {
      const strategy = new GlobalPartitionStrategy();
      const context1 = new PlaintextSecurityContext("test1");
      const context2 = new PlaintextSecurityContext("test2");
      
      expect(strategy.shouldSync(context1, context2)).toBe(true);
      expect(strategy.shouldSync(context2, context1)).toBe(true);
    });

    test("allows access to all data", () => {
      const strategy = new GlobalPartitionStrategy();
      const context = new PlaintextSecurityContext("test");
      
      const data = {
        contextId: "other",
        ciphertext: new Uint8Array(),
      };
      
      expect(strategy.canAccess(context, data)).toBe(true);
    });

    test("returns all contexts as sync targets", () => {
      const strategy = new GlobalPartitionStrategy();
      const localContext = new PlaintextSecurityContext("local");
      
      const contexts: SecurityContext[] = [
        new PlaintextSecurityContext("ctx1"),
        new PlaintextSecurityContext("ctx2"),
        new PlaintextSecurityContext("ctx3"),
      ];
      
      const filtered = strategy.filterSyncTargets(localContext, contexts);
      expect(filtered).toEqual(contexts);
    });
  });

  describe("PlaintextSecurityFactory", () => {
    test("creates plaintext components", () => {
      const factory = new PlaintextSecurityFactory();
      const context = new PlaintextSecurityContext("test");
      
      const auth = factory.createAuthProvider(context);
      expect(auth).toBeInstanceOf(PlaintextAuthProvider);
      
      const encryption = factory.createEncryptionProvider(context);
      expect(encryption).toBeInstanceOf(PlaintextEncryptionProvider);
      
      const partition = factory.createPartitionStrategy(context);
      expect(partition).toBeInstanceOf(GlobalPartitionStrategy);
    });
  });

  describe("createPlaintextSecurity helper", () => {
    test("creates complete plaintext security setup", () => {
      const security = createPlaintextSecurity("test");
      
      expect(security.context).toBeInstanceOf(PlaintextSecurityContext);
      expect(security.context.id).toBe("test");
      expect(security.auth).toBeInstanceOf(PlaintextAuthProvider);
      expect(security.encryption).toBeInstanceOf(PlaintextEncryptionProvider);
      expect(security.partition).toBeInstanceOf(GlobalPartitionStrategy);
    });

    test("uses default context id when not provided", () => {
      const security = createPlaintextSecurity();
      expect(security.context.id).toBe("plaintext-global");
    });
  });

  describe("PLAINTEXT_WARNING", () => {
    test("contains appropriate warning message", () => {
      expect(PLAINTEXT_WARNING).toContain("WARNING");
      expect(PLAINTEXT_WARNING).toContain("No encryption");
      expect(PLAINTEXT_WARNING).toContain("development only");
      expect(PLAINTEXT_WARNING).toContain("DO NOT use in production");
    });
  });
});