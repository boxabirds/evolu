/**
 * Backward compatibility layer for timestamp creation.
 * This module provides functions to bridge the old owner-based
 * timestamp creation with the new context-based approach.
 */

import type { NanoIdLibDep } from "../NanoId.js";
import type { Owner, OwnerWithWriteAccess } from "./Owner.js";
import type { SymmetricCrypto } from "../Crypto.js";
import { 
  createInitialTimestamp as createInitialTimestampLegacy,
  createInitialTimestampWithContext,
  type Timestamp 
} from "./Timestamp.js";
import { OwnerSecurityContext } from "./OwnerAdapters.js";

/**
 * Creates a timestamp for an owner using the new context-based approach.
 * This maintains backward compatibility while using the refactored internals.
 */
export const createTimestampForOwner = (
  owner: Owner | OwnerWithWriteAccess,
  nanoIdDep?: NanoIdLibDep
): Timestamp => {
  const context = new OwnerSecurityContext(owner, [], nanoIdDep);
  return createInitialTimestampWithContext(context);
};

/**
 * Transition helper that creates a timestamp using either the legacy
 * or context-based approach depending on what's available.
 */
export const createTimestampCompat = (
  ownerOrContext: Owner | OwnerWithWriteAccess | { createNodeId: () => string },
  deps?: NanoIdLibDep
): Timestamp => {
  // Check if it's a SecurityContext (has createNodeId method)
  if ('createNodeId' in ownerOrContext && typeof ownerOrContext.createNodeId === 'function') {
    return createInitialTimestampWithContext(ownerOrContext as any);
  }
  
  // Otherwise treat as Owner
  return createTimestampForOwner(
    ownerOrContext as Owner | OwnerWithWriteAccess, 
    deps
  );
};