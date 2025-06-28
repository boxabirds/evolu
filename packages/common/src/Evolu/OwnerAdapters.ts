/**
 * Adapters that allow the existing owner-based security system
 * to work with the new security abstractions. This enables a
 * gradual migration while maintaining backward compatibility.
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
import type { 
  Owner, 
  OwnerId, 
  WriteKey,
  SharedOwner,
  OwnerWithWriteAccess,
} from "./Owner.js";
import type { NodeId } from "./Timestamp.js";
import type { SymmetricCrypto } from "../Crypto.js";
import { createSlip21NodeId } from "./Timestamp.js";

/**
 * Adapts an Owner to work as a SecurityContext
 */
export class OwnerSecurityContext implements SecurityContext {
  readonly type = "owner" as const;
  
  constructor(
    private readonly owner: Owner | OwnerWithWriteAccess,
    private readonly sharedOwners: ReadonlyArray<SharedOwner> = []
  ) {}
  
  get id(): string {
    return this.owner.id;
  }
  
  createNodeId(): NodeId {
    // Use the existing SLIP-21 based node ID generation
    return createSlip21NodeId(this.owner.encryptionKey);
  }
  
  getPartitionKey(): string {
    // Owner ID is the partition key in the current system
    return this.owner.id;
  }
  
  get metadata() {
    return {
      sharedOwnerCount: this.sharedOwners.length,
      hasWriteAccess: 'writeKey' in this.owner,
    };
  }
}

/**
 * Adapts the owner's WriteKey system to the AuthProvider interface
 */
export class OwnerAuthProvider implements AuthProvider {
  constructor(
    private readonly owner: Owner | OwnerWithWriteAccess
  ) {}
  
  async createAuthProof(message: BinaryData): Promise<AuthProof> {
    // In the current system, the WriteKey itself serves as the auth proof
    // In a real implementation, this would create a signature
    return {
      type: "owner-writekey",
      data: this.owner.writeKey,
    };
  }
  
  async verifyAuthProof(message: BinaryData, proof: AuthProof): Promise<boolean> {
    if (proof.type !== "owner-writekey") {
      return false;
    }
    
    // In the current system, verification means checking if the WriteKey matches
    // This is a simplified version - real implementation would verify signatures
    return this.compareWriteKeys(proof.data as WriteKey, this.owner.writeKey);
  }
  
  getPublicIdentifier(): string {
    return `owner:${this.owner.id}`;
  }
  
  private compareWriteKeys(a: WriteKey, b: WriteKey): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

/**
 * Adapts the existing SymmetricCrypto to the EncryptionProvider interface
 */
export class OwnerEncryptionProvider implements EncryptionProvider {
  constructor(
    private readonly symmetricCrypto: SymmetricCrypto,
    private readonly owner: Owner | OwnerWithWriteAccess
  ) {}
  
  async encrypt(plaintext: BinaryData, context: SecurityContext): Promise<EncryptedData> {
    const result = this.symmetricCrypto.encrypt(
      plaintext as Uint8Array,
      this.owner.encryptionKey
    );
    
    return {
      contextId: context.id,
      ciphertext: new Uint8Array([
        ...result.nonce,
        ...result.ciphertext
      ]),
      metadata: {
        nonceLength: this.symmetricCrypto.nonceLength,
      },
    };
  }
  
  async decrypt(encrypted: EncryptedData, context: SecurityContext): Promise<BinaryData> {
    const nonceLength = encrypted.metadata?.nonceLength as number || this.symmetricCrypto.nonceLength;
    const nonce = encrypted.ciphertext.slice(0, nonceLength);
    const ciphertext = encrypted.ciphertext.slice(nonceLength);
    
    const result = this.symmetricCrypto.decrypt(
      ciphertext,
      this.owner.encryptionKey,
      nonce
    );
    
    if (!result.success) {
      throw new Error(`Decryption failed: ${result.error.type}`);
    }
    
    return result.value;
  }
  
  canDecrypt(encrypted: EncryptedData, context: SecurityContext): boolean {
    // Can decrypt if it's our own data or from a shared owner
    return encrypted.contextId === this.owner.id ||
           this.isSharedOwner(encrypted.contextId);
  }
  
  private isSharedOwner(contextId: string): boolean {
    // Check if this is implemented via shared owners
    // This is a simplified check - real implementation would be more robust
    return false; // Placeholder
  }
}

/**
 * Adapts the owner-based partitioning logic to the PartitionStrategy interface
 */
export class OwnerPartitionStrategy implements PartitionStrategy {
  constructor(
    private readonly owner: Owner | OwnerWithWriteAccess,
    private readonly sharedOwners: ReadonlyArray<SharedOwner> = []
  ) {}
  
  shouldSync(localContext: SecurityContext, remoteContext: SecurityContext): boolean {
    // Sync if same owner or in shared owners list
    if (localContext.id === remoteContext.id) {
      return true;
    }
    
    // Check if remote is a shared owner
    return this.sharedOwners.some(shared => shared.id === remoteContext.id);
  }
  
  canAccess(context: SecurityContext, data: EncryptedData): boolean {
    // Can access own data or shared owner data
    return data.contextId === context.id ||
           this.sharedOwners.some(shared => shared.id === data.contextId);
  }
  
  filterSyncTargets(
    localContext: SecurityContext,
    contexts: ReadonlyArray<SecurityContext>
  ): ReadonlyArray<SecurityContext> {
    return contexts.filter(ctx => this.shouldSync(localContext, ctx));
  }
}

/**
 * Factory that creates owner-based security components
 */
export class OwnerSecurityFactory implements SecurityFactory {
  constructor(
    private readonly symmetricCrypto: SymmetricCrypto,
    private readonly sharedOwners: ReadonlyArray<SharedOwner> = []
  ) {}
  
  createAuthProvider(context: SecurityContext): AuthProvider {
    if (!(context instanceof OwnerSecurityContext)) {
      throw new Error("OwnerSecurityFactory requires OwnerSecurityContext");
    }
    const ownerContext = context as OwnerSecurityContext;
    return new OwnerAuthProvider(ownerContext['owner']);
  }
  
  createEncryptionProvider(context: SecurityContext): EncryptionProvider {
    if (!(context instanceof OwnerSecurityContext)) {
      throw new Error("OwnerSecurityFactory requires OwnerSecurityContext");
    }
    const ownerContext = context as OwnerSecurityContext;
    return new OwnerEncryptionProvider(this.symmetricCrypto, ownerContext['owner']);
  }
  
  createPartitionStrategy(context: SecurityContext): PartitionStrategy {
    if (!(context instanceof OwnerSecurityContext)) {
      throw new Error("OwnerSecurityFactory requires OwnerSecurityContext");
    }
    const ownerContext = context as OwnerSecurityContext;
    return new OwnerPartitionStrategy(ownerContext['owner'], this.sharedOwners);
  }
}

/**
 * Helper to create a complete owner-based security setup
 */
export const createOwnerSecurity = (
  owner: Owner | OwnerWithWriteAccess,
  symmetricCrypto: SymmetricCrypto,
  sharedOwners: ReadonlyArray<SharedOwner> = []
) => {
  const context = new OwnerSecurityContext(owner, sharedOwners);
  const factory = new OwnerSecurityFactory(symmetricCrypto, sharedOwners);
  
  return {
    context,
    auth: factory.createAuthProvider(context),
    encryption: factory.createEncryptionProvider(context),
    partition: factory.createPartitionStrategy(context),
  };
};