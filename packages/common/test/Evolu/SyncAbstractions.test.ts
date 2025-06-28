import { describe, expect, test, vi } from "vitest";
import {
  SingleOwnerSyncAdapter,
  MultiContextSyncManager,
  createSyncManager,
  createAuthProviderGetter,
} from "../../src/Evolu/SyncAbstractions.js";
import type { 
  SecurityContext,
  PartitionStrategy,
  AuthProvider,
} from "../../src/Evolu/SecurityAbstractions.js";
import type { ProtocolMessage } from "../../src/Evolu/Protocol.js";
import type { Sync } from "../../src/Evolu/Sync.js";
import type { OwnerId, WriteKey } from "../../src/Evolu/Owner.js";

// Mock implementations
const createMockContext = (id: string, type = "owner"): SecurityContext => ({
  id,
  type,
  createNodeId: () => "0123456789abcdef" as any,
  getPartitionKey: () => id,
});

const createMockPartitionStrategy = (
  shouldSyncImpl?: (local: SecurityContext, remote: SecurityContext) => boolean
): PartitionStrategy => ({
  shouldSync: shouldSyncImpl || (() => true),
  canAccess: () => true,
  filterSyncTargets: (local, contexts) => 
    contexts.filter(ctx => (shouldSyncImpl || (() => true))(local, ctx)),
});

const createMockSync = (): Sync => ({
  send: vi.fn(),
});

const createMockProtocolMessage = (): ProtocolMessage => 
  new Uint8Array([1, 2, 3]) as ProtocolMessage;

describe("SyncAbstractions", () => {
  describe("SingleOwnerSyncAdapter", () => {
    test("sends message only for its own context", () => {
      const context = createMockContext("owner1");
      const sync = createMockSync();
      const strategy = createMockPartitionStrategy();
      const adapter = new SingleOwnerSyncAdapter(context, sync.send, strategy);
      
      const message = createMockProtocolMessage();
      
      // Should send for own context
      adapter.sendForContext(context, message);
      expect(sync.send).toHaveBeenCalledWith(message);
      
      // Should not send for different context
      vi.clearAllMocks();
      const otherContext = createMockContext("owner2");
      adapter.sendForContext(otherContext, message);
      expect(sync.send).not.toHaveBeenCalled();
    });
    
    test("sends message when getMessage returns non-null", () => {
      const context = createMockContext("owner1");
      const sync = createMockSync();
      const strategy = createMockPartitionStrategy();
      const adapter = new SingleOwnerSyncAdapter(context, sync.send, strategy);
      
      const message = createMockProtocolMessage();
      const getMessage = vi.fn((ctx: SecurityContext) => 
        ctx.id === "owner1" ? message : null
      );
      
      adapter.sendForAllContexts(getMessage);
      expect(getMessage).toHaveBeenCalledWith(context);
      expect(sync.send).toHaveBeenCalledWith(message);
    });
    
    test("returns syncable contexts based on partition strategy", () => {
      const context = createMockContext("owner1");
      const sync = createMockSync();
      const strategy = createMockPartitionStrategy(
        (local, remote) => local.id === "owner1" && remote.id === "owner2"
      );
      const adapter = new SingleOwnerSyncAdapter(context, sync.send, strategy);
      
      const remoteContext1 = createMockContext("owner2");
      const remoteContext2 = createMockContext("owner3");
      
      expect(adapter.getSyncableContexts(remoteContext1)).toEqual([context]);
      expect(adapter.getSyncableContexts(remoteContext2)).toEqual([]);
    });
  });
  
  describe("MultiContextSyncManager", () => {
    test("sends message only for contexts it manages", () => {
      const context1 = createMockContext("owner1");
      const context2 = createMockContext("owner2");
      const contexts = [context1, context2];
      const sync = createMockSync();
      const strategy = createMockPartitionStrategy();
      const manager = new MultiContextSyncManager(contexts, sync.send, strategy);
      
      const message = createMockProtocolMessage();
      
      // Should send for managed context
      manager.sendForContext(context1, message);
      expect(sync.send).toHaveBeenCalledWith(message);
      
      // Should not send for unmanaged context
      vi.clearAllMocks();
      const unmanagedContext = createMockContext("owner3");
      manager.sendForContext(unmanagedContext, message);
      expect(sync.send).not.toHaveBeenCalled();
    });
    
    test("sends first non-null message from contexts", () => {
      const context1 = createMockContext("owner1");
      const context2 = createMockContext("owner2");
      const contexts = [context1, context2];
      const sync = createMockSync();
      const strategy = createMockPartitionStrategy();
      const manager = new MultiContextSyncManager(contexts, sync.send, strategy);
      
      const message1 = createMockProtocolMessage();
      const message2 = new Uint8Array([4, 5, 6]) as ProtocolMessage;
      const getMessage = vi.fn((ctx: SecurityContext) => {
        if (ctx.id === "owner1") return null;
        if (ctx.id === "owner2") return message2;
        return null;
      });
      
      manager.sendForAllContexts(getMessage);
      expect(getMessage).toHaveBeenCalledWith(context1);
      expect(getMessage).toHaveBeenCalledWith(context2);
      expect(sync.send).toHaveBeenCalledWith(message2);
      expect(sync.send).toHaveBeenCalledTimes(1);
    });
    
    test("filters syncable contexts using partition strategy", () => {
      const context1 = createMockContext("owner1");
      const context2 = createMockContext("owner2");
      const context3 = createMockContext("owner3");
      const contexts = [context1, context2, context3];
      const sync = createMockSync();
      const strategy = createMockPartitionStrategy(
        (_local, remote) => remote.id !== "owner3"
      );
      const manager = new MultiContextSyncManager(contexts, sync.send, strategy);
      
      const remoteContext = createMockContext("remote");
      const syncable = manager.getSyncableContexts(remoteContext);
      
      expect(syncable).toEqual([context1, context2]);
      expect(syncable).not.toContain(context3);
    });
  });
  
  describe("createSyncManager", () => {
    test("creates SingleOwnerSyncAdapter for single context", () => {
      const context = createMockContext("owner1");
      const sync = createMockSync();
      const strategy = createMockPartitionStrategy();
      
      const manager = createSyncManager({
        contexts: [context],
        partitionStrategy: strategy,
        sync,
      });
      
      expect(manager).toBeInstanceOf(SingleOwnerSyncAdapter);
    });
    
    test("creates MultiContextSyncManager for multiple contexts", () => {
      const contexts = [
        createMockContext("owner1"),
        createMockContext("owner2"),
      ];
      const sync = createMockSync();
      const strategy = createMockPartitionStrategy();
      
      const manager = createSyncManager({
        contexts,
        partitionStrategy: strategy,
        sync,
      });
      
      expect(manager).toBeInstanceOf(MultiContextSyncManager);
    });
  });
  
  describe("createAuthProviderGetter", () => {
    test("returns registered auth provider", () => {
      const authProvider: AuthProvider = {
        createAuthProof: vi.fn(),
        verifyAuthProof: vi.fn(),
        getPublicIdentifier: () => "test",
      };
      const authProviders = new Map([["owner1", authProvider]]);
      const getWriteKey = vi.fn();
      
      const getter = createAuthProviderGetter(getWriteKey, authProviders);
      const context = createMockContext("owner1");
      
      expect(getter(context)).toBe(authProvider);
      expect(getWriteKey).not.toHaveBeenCalled();
    });
    
    test("falls back to WriteKey for owner contexts", async () => {
      const writeKey = new Uint8Array([1, 2, 3, 4]) as WriteKey;
      const getWriteKey = vi.fn((ownerId: OwnerId) => 
        ownerId === "owner1" ? writeKey : null
      );
      const authProviders = new Map<string, AuthProvider>();
      
      const getter = createAuthProviderGetter(getWriteKey, authProviders);
      const context = createMockContext("owner1", "owner");
      
      const authProvider = getter(context);
      expect(authProvider).not.toBeNull();
      expect(getWriteKey).toHaveBeenCalledWith("owner1");
      
      // Test the created auth provider
      const proof = await authProvider!.createAuthProof(new Uint8Array());
      expect(proof.type).toBe("owner-writekey");
      expect(proof.data).toBe(writeKey);
      
      const isValid = await authProvider!.verifyAuthProof(
        new Uint8Array(),
        proof
      );
      expect(isValid).toBe(true);
    });
    
    test("returns null for non-owner contexts without auth provider", () => {
      const getWriteKey = vi.fn();
      const authProviders = new Map<string, AuthProvider>();
      
      const getter = createAuthProviderGetter(getWriteKey, authProviders);
      const context = createMockContext("group1", "group");
      
      expect(getter(context)).toBeNull();
      expect(getWriteKey).not.toHaveBeenCalled();
    });
  });
});