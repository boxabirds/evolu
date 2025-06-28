/**
 * Plaintext implementations of security abstractions for Phase 1.
 * These implementations provide no actual security - they're used
 * to test the CRDT engine in isolation from encryption concerns.
 */

import type {
  SecurityContext,
  AuthProvider,
  EncryptionProvider,
  PartitionStrategy,
  AuthProof,
  BinaryData,
  EncryptedData,
  SecurityFactory,
} from "./SecurityAbstractions.js";
import type { NodeId } from "./Timestamp.js";

/**
 * A security context that provides no encryption or authentication.
 * Used for Phase 1 testing and development.
 */
export class PlaintextSecurityContext implements SecurityContext {
  readonly type = "plaintext" as const;
  readonly metadata = { warning: "No encryption - development only" };
  
  constructor(
    readonly id: string = "plaintext-global"
  ) {}
  
  createNodeId(): NodeId {
    // Generate a valid 16-character hex NodeId for plaintext mode
    // Uses a simple hash of the context id and current time
    const source = `${this.id}-${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      const char = source.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to hex and pad/truncate to 16 characters
    const hex = Math.abs(hash).toString(16).padStart(16, '0').slice(0, 16);
    return hex as NodeId;
  }
  
  getPartitionKey(): string {
    // All plaintext data is in the same partition
    return "global";
  }
}

/**
 * Auth provider that creates dummy proofs for plaintext operation.
 * NO ACTUAL AUTHENTICATION IS PROVIDED.
 */
export class PlaintextAuthProvider implements AuthProvider {
  constructor(private readonly context: SecurityContext) {}
  
  async createAuthProof(message: BinaryData): Promise<AuthProof> {
    // Create a dummy proof that just includes context ID
    // This provides no actual authentication
    const encoder = new TextEncoder();
    return {
      type: "plaintext",
      data: encoder.encode(`plaintext-proof-${this.context.id}`),
    };
  }
  
  async verifyAuthProof(message: BinaryData, proof: AuthProof): Promise<boolean> {
    // In plaintext mode, all proofs are "valid"
    // This is obviously insecure and only for development
    return proof.type === "plaintext";
  }
  
  getPublicIdentifier(): string {
    return `plaintext:${this.context.id}`;
  }
}

/**
 * Encryption provider that performs no encryption.
 * Data is stored and transmitted in plaintext.
 * FOR DEVELOPMENT ONLY.
 */
export class PlaintextEncryptionProvider implements EncryptionProvider {
  async encrypt(plaintext: BinaryData, context: SecurityContext): Promise<EncryptedData> {
    // "Encrypt" by just wrapping the plaintext
    // No actual encryption is performed
    return {
      contextId: context.id,
      ciphertext: plaintext,
      metadata: {
        encrypted: false,
        warning: "Data is not encrypted",
      },
    };
  }
  
  async decrypt(encrypted: EncryptedData, context: SecurityContext): Promise<BinaryData> {
    // "Decrypt" by just returning the ciphertext
    // since it's actually plaintext
    return encrypted.ciphertext;
  }
  
  canDecrypt(encrypted: EncryptedData, context: SecurityContext): boolean {
    // In plaintext mode, anyone can "decrypt" anything
    return true;
  }
}

/**
 * Partition strategy that allows all contexts to sync with each other.
 * This creates a global, unpartitioned data space.
 */
export class GlobalPartitionStrategy implements PartitionStrategy {
  shouldSync(localContext: SecurityContext, remoteContext: SecurityContext): boolean {
    // Everyone syncs with everyone
    return true;
  }
  
  canAccess(context: SecurityContext, data: EncryptedData): boolean {
    // Everyone can access everything
    return true;
  }
  
  filterSyncTargets(
    localContext: SecurityContext,
    contexts: ReadonlyArray<SecurityContext>
  ): ReadonlyArray<SecurityContext> {
    // Sync with all contexts
    return contexts;
  }
}

/**
 * Factory that creates plaintext security components.
 * Used for Phase 1 development and testing.
 */
export class PlaintextSecurityFactory implements SecurityFactory {
  createAuthProvider(context: SecurityContext): AuthProvider {
    return new PlaintextAuthProvider(context);
  }
  
  createEncryptionProvider(context: SecurityContext): EncryptionProvider {
    return new PlaintextEncryptionProvider();
  }
  
  createPartitionStrategy(context: SecurityContext): PartitionStrategy {
    return new GlobalPartitionStrategy();
  }
}

/**
 * Create a complete plaintext security setup for testing
 */
export const createPlaintextSecurity = (contextId?: string) => {
  const context = new PlaintextSecurityContext(contextId);
  const factory = new PlaintextSecurityFactory();
  
  return {
    context,
    auth: factory.createAuthProvider(context),
    encryption: factory.createEncryptionProvider(context),
    partition: factory.createPartitionStrategy(context),
  };
};

/**
 * Warning message to display when using plaintext mode
 */
export const PLAINTEXT_WARNING = `
WARNING: Evolu is running in plaintext mode.
- No encryption is applied to data
- No authentication is performed
- All data is visible to anyone
- This mode is for development only
- DO NOT use in production
`.trim();