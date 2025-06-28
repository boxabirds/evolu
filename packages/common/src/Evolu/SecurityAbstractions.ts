/**
 * Security abstractions for Evolu that allow CRDT to work independently
 * of specific security implementations (owner-based, group-based, etc.)
 * 
 * These interfaces enable clean separation between the CRDT synchronization
 * engine and the security/encryption layer.
 */

import type { NodeId } from "./Timestamp.js";

/**
 * Binary data type for cryptographic operations
 */
export type BinaryData = Uint8Array;

/**
 * Represents an authentication proof that can be verified
 */
export interface AuthProof {
  readonly type: string;
  readonly data: BinaryData;
}

/**
 * Represents encrypted data with metadata
 */
export interface EncryptedData {
  readonly contextId: string;
  readonly ciphertext: BinaryData;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Security context represents the security environment in which
 * operations are performed. This could be an owner, a group,
 * or even a plaintext context for unencrypted operation.
 */
export interface SecurityContext {
  /**
   * Unique identifier for this security context
   */
  readonly id: string;
  
  /**
   * Type of security context
   */
  readonly type: "owner" | "group" | "plaintext" | string;
  
  /**
   * Creates a unique node ID for use in CRDT timestamps.
   * This replaces the owner-specific node ID generation.
   */
  createNodeId(): NodeId;
  
  /**
   * Returns the partition key used for data segregation.
   * Data with the same partition key can be synced together.
   */
  getPartitionKey(): string;
  
  /**
   * Optional metadata about the context
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Provides authentication capabilities for a security context.
 * This abstraction replaces the owner-specific WriteKey system.
 */
export interface AuthProvider {
  /**
   * Creates an authentication proof for a message.
   * This proof can be verified by other nodes to ensure authenticity.
   * 
   * @param message - The message to authenticate
   * @returns Authentication proof that can be transmitted
   */
  createAuthProof(message: BinaryData): Promise<AuthProof>;
  
  /**
   * Verifies an authentication proof for a message.
   * 
   * @param message - The original message
   * @param proof - The authentication proof to verify
   * @returns True if the proof is valid, false otherwise
   */
  verifyAuthProof(message: BinaryData, proof: AuthProof): Promise<boolean>;
  
  /**
   * Gets the public identifier that others can use to verify proofs
   * from this auth provider (e.g., public key, group ID, etc.)
   */
  getPublicIdentifier(): string;
}

/**
 * Provides encryption and decryption capabilities for a security context.
 * This abstraction replaces the owner-specific SymmetricCrypto.
 */
export interface EncryptionProvider {
  /**
   * Encrypts data using the security context.
   * 
   * @param plaintext - Data to encrypt
   * @param context - Security context for encryption
   * @returns Encrypted data with metadata
   */
  encrypt(plaintext: BinaryData, context: SecurityContext): Promise<EncryptedData>;
  
  /**
   * Decrypts data using the security context.
   * 
   * @param encrypted - Encrypted data to decrypt
   * @param context - Security context for decryption
   * @returns Decrypted plaintext
   * @throws Error if decryption fails
   */
  decrypt(encrypted: EncryptedData, context: SecurityContext): Promise<BinaryData>;
  
  /**
   * Checks if this provider can decrypt the given encrypted data
   * without actually attempting decryption.
   * 
   * @param encrypted - Encrypted data to check
   * @param context - Security context to check with
   * @returns True if decryption is possible
   */
  canDecrypt(encrypted: EncryptedData, context: SecurityContext): boolean;
}

/**
 * Determines how data is partitioned and synchronized between
 * different security contexts. This abstraction replaces the
 * hard-coded owner-based partitioning logic.
 */
export interface PartitionStrategy {
  /**
   * Determines whether two security contexts should synchronize
   * data with each other.
   * 
   * @param localContext - The local security context
   * @param remoteContext - The remote security context
   * @returns True if contexts should sync, false otherwise
   */
  shouldSync(localContext: SecurityContext, remoteContext: SecurityContext): boolean;
  
  /**
   * Determines whether a security context can access (decrypt/read)
   * specific encrypted data.
   * 
   * @param context - The security context attempting access
   * @param data - The encrypted data to access
   * @returns True if access is allowed, false otherwise
   */
  canAccess(context: SecurityContext, data: EncryptedData): boolean;
  
  /**
   * Filters a list of contexts to only those that should
   * participate in synchronization with the local context.
   * 
   * @param localContext - The local security context
   * @param contexts - List of potential remote contexts
   * @returns Filtered list of contexts to sync with
   */
  filterSyncTargets(
    localContext: SecurityContext, 
    contexts: ReadonlyArray<SecurityContext>
  ): ReadonlyArray<SecurityContext>;
}

/**
 * Factory for creating security-related components.
 * This allows different security implementations to be plugged in.
 */
export interface SecurityFactory {
  /**
   * Creates an auth provider for the given context
   */
  createAuthProvider(context: SecurityContext): AuthProvider;
  
  /**
   * Creates an encryption provider for the given context
   */
  createEncryptionProvider(context: SecurityContext): EncryptionProvider;
  
  /**
   * Creates a partition strategy for the given context
   */
  createPartitionStrategy(context: SecurityContext): PartitionStrategy;
}

/**
 * Result type for operations that can fail
 */
export type SecurityResult<T> = 
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: Error };

/**
 * Helper function to create a successful result
 */
export const success = <T>(value: T): SecurityResult<T> => ({
  success: true,
  value,
});

/**
 * Helper function to create a failure result
 */
export const failure = <T>(error: Error): SecurityResult<T> => ({
  success: false,
  error,
});

/**
 * Type guard to check if a result is successful
 */
export const isSuccess = <T>(result: SecurityResult<T>): result is { success: true; value: T } => 
  result.success;

/**
 * Type guard to check if a result is a failure
 */
export const isFailure = <T>(result: SecurityResult<T>): result is { success: false; error: Error } => 
  !result.success;