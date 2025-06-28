/**
 * Protocol-specific abstractions that bridge the security abstractions
 * with the Evolu Protocol implementation.
 */

import type {
  SecurityContext,
  AuthProvider,
  AuthProof,
  BinaryData,
} from "./SecurityAbstractions.js";
import type { 
  WriteKey,
  OwnerId,
} from "./Owner.js";
import type { 
  NonNegativeInt,
  PositiveInt,
} from "../Type.js";
import { 
  type ProtocolMessage,
  type Storage as BaseStorage,
  type BinaryOwnerId,
  type EncryptedCrdtMessage,
  type EncryptedDbChange,
  type Fingerprint,
  type FingerprintRange,
  type RangeUpperBound,
} from "./Protocol.js";
import type { BinaryTimestamp } from "./Timestamp.js";
import type { NonEmptyReadonlyArray } from "../Array.js";

/**
 * Extended storage interface that supports both WriteKey (legacy)
 * and AuthProof (new) validation methods.
 */
export interface Storage extends BaseStorage {
  /** 
   * Validates an auth proof for the given owner.
   * This will eventually replace validateWriteKey.
   */
  readonly validateAuthProof?: (
    ownerId: BinaryOwnerId,
    proof: AuthProof,
    message: BinaryData,
  ) => Promise<boolean>;
  
  /** 
   * Stores auth material for the given owner.
   * This will eventually replace setWriteKey.
   */
  readonly setAuthMaterial?: (
    ownerId: BinaryOwnerId,
    material: AuthProof,
  ) => Promise<boolean>;
}

/**
 * Auth mode for protocol messages, replacing WriteKeyMode
 */
export const AuthMode = {
  None: 0,
  Single: 1,
  Rotation: 2,
} as const;

export type AuthMode = (typeof AuthMode)[keyof typeof AuthMode];

/**
 * Protocol auth adapter that bridges between the old WriteKey system
 * and the new AuthProvider abstraction.
 */
export class ProtocolAuthAdapter {
  constructor(
    private readonly authProvider: AuthProvider,
    private readonly legacyWriteKey?: WriteKey,
  ) {}
  
  /**
   * Creates auth proof for protocol messages.
   * During transition, this may return WriteKey-based proofs.
   */
  async createProtocolAuth(message: BinaryData): Promise<AuthProof> {
    return this.authProvider.createAuthProof(message);
  }
  
  /**
   * Verifies auth proof from protocol messages.
   * During transition, this supports both WriteKey and AuthProof.
   */
  async verifyProtocolAuth(
    message: BinaryData,
    proof: AuthProof,
  ): Promise<boolean> {
    // Handle legacy WriteKey verification
    if (proof.type === "owner-writekey" && this.legacyWriteKey) {
      const proofKey = proof.data as WriteKey;
      if (proofKey.length !== this.legacyWriteKey.length) return false;
      for (let i = 0; i < proofKey.length; i++) {
        if (proofKey[i] !== this.legacyWriteKey[i]) return false;
      }
      return true;
    }
    
    return this.authProvider.verifyAuthProof(message, proof);
  }
  
  /**
   * Gets the WriteKey for legacy compatibility.
   * Returns undefined if not available.
   */
  getLegacyWriteKey(): WriteKey | undefined {
    return this.legacyWriteKey;
  }
  
  /**
   * Checks if this adapter has write access (can create auth proofs).
   */
  hasWriteAccess(): boolean {
    return this.legacyWriteKey !== undefined;
  }
}

/**
 * Protocol message options that use the new auth system
 */
export type ProtocolMessageOptions = {
  readonly totalMaxSize?: PositiveInt;
  readonly rangesMaxSize?: PositiveInt;
  readonly version?: NonNegativeInt;
} & (
  | {
      readonly type: "initiator";
      /** Auth adapter for creating proofs */
      readonly authAdapter?: ProtocolAuthAdapter;
      /** Optional rotation auth for key rotation scenarios */
      readonly rotationAuth?: AuthProof;
    }
  | {
      readonly type: "non-initiator";
      readonly errorCode: NonNegativeInt;
    }
);

/**
 * Creates a storage adapter that supports both legacy and new auth systems
 */
export const createStorageAdapter = (
  baseStorage: BaseStorage,
  authProvider?: AuthProvider,
): Storage => {
  // If the storage already supports the new methods, return as is
  const storage = baseStorage as Storage;
  if (storage.validateAuthProof && storage.setAuthMaterial) {
    return storage;
  }
  
  // Otherwise, create an adapter that uses AuthProvider with WriteKey fallback
  return {
    ...baseStorage,
    
    validateAuthProof: async (ownerId, proof, message) => {
      // If it's a WriteKey-based proof, use legacy validation
      if (proof.type === "owner-writekey") {
        return baseStorage.validateWriteKey(ownerId, proof.data as WriteKey);
      }
      
      // Otherwise, we need an AuthProvider to verify
      if (!authProvider) {
        return false;
      }
      
      return authProvider.verifyAuthProof(message, proof);
    },
    
    setAuthMaterial: async (ownerId, material) => {
      // If it's WriteKey-based material, use legacy method
      if (material.type === "owner-writekey") {
        return baseStorage.setWriteKey(ownerId, material.data as WriteKey);
      }
      
      // For now, we don't support storing other auth materials
      // This will be implemented when we fully migrate
      return true;
    },
  };
};

/**
 * Helper to convert WriteKey to AuthProof for backward compatibility
 */
export const writeKeyToAuthProof = (writeKey: WriteKey): AuthProof => ({
  type: "owner-writekey",
  data: writeKey,
});

/**
 * Helper to extract WriteKey from AuthProof if possible
 */
export const authProofToWriteKey = (proof: AuthProof): WriteKey | null => {
  if (proof.type === "owner-writekey") {
    return proof.data as WriteKey;
  }
  return null;
};