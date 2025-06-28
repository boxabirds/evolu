/**
 * Sync-specific abstractions that integrate with the security abstractions
 * to enable flexible synchronization strategies.
 */

import type {
  SecurityContext,
  PartitionStrategy,
  AuthProvider,
  EncryptionProvider,
} from "./SecurityAbstractions.js";
import type { 
  ProtocolMessage,
  Storage,
  CrdtMessage,
} from "./Protocol.js";
import type { 
  OwnerId,
  WriteKey,
} from "./Owner.js";
import type { Sync, SyncConfig } from "./Sync.js";

/**
 * Extended sync configuration that supports multiple security contexts
 */
export interface MultiContextSyncConfig extends Omit<SyncConfig, 'onOpen' | 'onMessage'> {
  /** All security contexts this client can sync */
  readonly contexts: ReadonlyArray<SecurityContext>;
  
  /** Partition strategy for determining sync targets */
  readonly partitionStrategy: PartitionStrategy;
  
  /** Factory for creating auth providers */
  readonly getAuthProvider: (context: SecurityContext) => AuthProvider | null;
  
  /** Factory for creating encryption providers */
  readonly getEncryptionProvider: (context: SecurityContext) => EncryptionProvider | null;
  
  /** Called when sync connection opens */
  readonly onOpen: (syncManager: SyncManager) => void;
  
  /** Called when sync message received */
  readonly onMessage: (message: Uint8Array, syncManager: SyncManager) => void;
}

/**
 * Manages sync operations across multiple security contexts
 */
export interface SyncManager {
  /** Send a message for a specific context */
  readonly sendForContext: (context: SecurityContext, message: ProtocolMessage) => void;
  
  /** Send messages for all syncable contexts */
  readonly sendForAllContexts: (getMessage: (context: SecurityContext) => ProtocolMessage | null) => void;
  
  /** Get contexts that should sync with a remote context */
  readonly getSyncableContexts: (remoteContext: SecurityContext) => ReadonlyArray<SecurityContext>;
}

/**
 * Adapter that bridges single-owner sync to multi-context sync
 */
export class SingleOwnerSyncAdapter implements SyncManager {
  constructor(
    private readonly context: SecurityContext,
    private readonly send: Sync['send'],
    private readonly partitionStrategy: PartitionStrategy,
  ) {}
  
  sendForContext(context: SecurityContext, message: ProtocolMessage): void {
    // Only send if it's for our context
    if (context.id === this.context.id) {
      this.send(message);
    }
  }
  
  sendForAllContexts(getMessage: (context: SecurityContext) => ProtocolMessage | null): void {
    const message = getMessage(this.context);
    if (message) {
      this.send(message);
    }
  }
  
  getSyncableContexts(remoteContext: SecurityContext): ReadonlyArray<SecurityContext> {
    if (this.partitionStrategy.shouldSync(this.context, remoteContext)) {
      return [this.context];
    }
    return [];
  }
}

/**
 * Full multi-context sync manager implementation
 */
export class MultiContextSyncManager implements SyncManager {
  constructor(
    private readonly contexts: ReadonlyArray<SecurityContext>,
    private readonly send: Sync['send'],
    private readonly partitionStrategy: PartitionStrategy,
  ) {}
  
  sendForContext(context: SecurityContext, message: ProtocolMessage): void {
    // Verify we have this context
    const hasContext = this.contexts.some(ctx => ctx.id === context.id);
    if (hasContext) {
      this.send(message);
    }
  }
  
  sendForAllContexts(getMessage: (context: SecurityContext) => ProtocolMessage | null): void {
    // In the current protocol, we can only send one message at a time
    // In the future, we might batch messages for multiple contexts
    for (const context of this.contexts) {
      const message = getMessage(context);
      if (message) {
        this.send(message);
        // For now, send only the first message
        // TODO: Support batching multiple context messages
        break;
      }
    }
  }
  
  getSyncableContexts(remoteContext: SecurityContext): ReadonlyArray<SecurityContext> {
    return this.partitionStrategy.filterSyncTargets(remoteContext, this.contexts);
  }
}

/**
 * Options for creating a sync manager
 */
export interface CreateSyncManagerOptions {
  /** Security contexts to manage */
  readonly contexts: ReadonlyArray<SecurityContext>;
  
  /** Partition strategy for sync decisions */
  readonly partitionStrategy: PartitionStrategy;
  
  /** The underlying sync transport */
  readonly sync: Sync;
}

/**
 * Creates a sync manager based on the number of contexts
 */
export const createSyncManager = ({
  contexts,
  partitionStrategy,
  sync,
}: CreateSyncManagerOptions): SyncManager => {
  if (contexts.length === 1) {
    return new SingleOwnerSyncAdapter(contexts[0], sync.send, partitionStrategy);
  }
  
  return new MultiContextSyncManager(contexts, sync.send, partitionStrategy);
};

/**
 * Helper to convert legacy WriteKey getter to context-aware auth provider getter
 */
export const createAuthProviderGetter = (
  getWriteKey: (ownerId: OwnerId) => WriteKey | null,
  authProviders: Map<string, AuthProvider>,
): ((context: SecurityContext) => AuthProvider | null) => {
  return (context: SecurityContext) => {
    // First check if we have a registered auth provider
    const authProvider = authProviders.get(context.id);
    if (authProvider) {
      return authProvider;
    }
    
    // Fall back to WriteKey-based auth for owner contexts
    if (context.type === "owner") {
      const writeKey = getWriteKey(context.id as OwnerId);
      if (writeKey) {
        // Create a temporary auth provider that uses the WriteKey
        // This will be replaced when we fully migrate to AuthProvider
        return {
          createAuthProof: async () => ({
            type: "owner-writekey",
            data: writeKey,
          }),
          verifyAuthProof: async (_message, proof) => {
            if (proof.type !== "owner-writekey") return false;
            const proofKey = proof.data as WriteKey;
            return proofKey.length === writeKey.length &&
                   proofKey.every((byte, i) => byte === writeKey[i]);
          },
          getPublicIdentifier: () => `owner:${context.id}`,
        };
      }
    }
    
    return null;
  };
};

/**
 * Sync coordination for handling protocol messages with partition strategy
 */
export interface SyncCoordinator {
  /** Process an incoming sync message */
  readonly processIncomingMessage: (
    message: Uint8Array,
    syncManager: SyncManager,
  ) => void;
  
  /** Initiate sync for specific contexts */
  readonly initiateSync: (
    contexts: ReadonlyArray<SecurityContext>,
    syncManager: SyncManager,
  ) => void;
}

/**
 * Options for processing protocol messages with security context
 */
export interface ProcessProtocolMessageOptions {
  /** The security context for this operation */
  readonly context: SecurityContext;
  
  /** Auth provider for the context */
  readonly authProvider: AuthProvider | null;
  
  /** Encryption provider for the context */
  readonly encryptionProvider: EncryptionProvider | null;
  
  /** Storage instance */
  readonly storage: Storage;
  
  /** Protocol version */
  readonly version?: number;
}