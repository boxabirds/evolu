/**
 * Epoch management for groups in Evolu.
 * 
 * Epochs provide versioning for group keys and membership changes.
 * When sensitive changes occur (like removing a member), the epoch
 * is incremented to ensure forward secrecy.
 */

import type { 
  GroupId, 
  EpochId, 
  Epoch,
  EpochKeyId
} from "./GroupTypes.js";
import { createIdFromString } from "../Type.js";
import type { NanoIdLibDep } from "../NanoId.js";

/**
 * Epoch metadata stored with each epoch
 */
export interface EpochMetadata {
  reason: "initial" | "member_removed" | "key_rotation" | "manual";
  initiatedBy: string;
  affectedMembers?: string[];
}

/**
 * Manager for group epochs providing versioning and key rotation points.
 */
export interface EpochManager {
  readonly groupId: GroupId;
  readonly currentEpoch: Epoch;
  
  /**
   * Gets the current active epoch
   */
  getCurrentEpoch(): Epoch;
  
  /**
   * Increments to a new epoch (manual in Phase 1)
   * @param reason - Why the epoch is being incremented
   * @param initiatedBy - User ID who initiated the change
   * @returns The new epoch
   */
  incrementEpoch(reason: EpochMetadata["reason"], initiatedBy: string): Epoch;
  
  /**
   * Gets the epoch history for audit purposes
   */
  getEpochHistory(): ReadonlyArray<Epoch>;
  
  /**
   * Checks if a given epoch number is valid for this group
   */
  isValidEpoch(epochNumber: number): boolean;
  
  /**
   * Gets a specific epoch by number
   */
  getEpoch(epochNumber: number): Epoch | null;
}

/**
 * Simple in-memory epoch manager for Phase 1.
 * Phase 2 will persist epochs to the database.
 */
export class InMemoryEpochManager implements EpochManager {
  private epochs: Map<number, Epoch>;
  private _currentEpoch: Epoch;
  
  constructor(
    public readonly groupId: GroupId,
    initialEpoch?: Epoch,
    private readonly deps?: { nanoid: NanoIdLibDep }
  ) {
    this.epochs = new Map();
    
    if (initialEpoch) {
      this._currentEpoch = initialEpoch;
      this.epochs.set(initialEpoch.epochNumber, initialEpoch);
    } else {
      // Create initial epoch
      const epoch: Epoch = {
        id: this.createEpochId(1),
        groupId: this.groupId,
        epochNumber: 1,
        startedAt: new Date(),
        // Don't set optional properties to undefined with exactOptionalPropertyTypes
      };
      
      this._currentEpoch = epoch;
      this.epochs.set(1, epoch);
    }
  }

  get currentEpoch(): Epoch {
    return this._currentEpoch;
  }

  getCurrentEpoch(): Epoch {
    return this._currentEpoch;
  }

  incrementEpoch(
    reason: EpochMetadata["reason"], 
    initiatedBy: string
  ): Epoch {
    // End the current epoch
    const currentEpoch = this.epochs.get(this._currentEpoch.epochNumber);
    if (currentEpoch && !currentEpoch.endedAt) {
      currentEpoch.endedAt = new Date();
    }

    // Create new epoch
    const newEpochNumber = this._currentEpoch.epochNumber + 1;
    const newEpoch: Epoch = {
      id: this.createEpochId(newEpochNumber),
      groupId: this.groupId,
      epochNumber: newEpochNumber,
      startedAt: new Date(),
      // Don't set optional properties to undefined with exactOptionalPropertyTypes
    };

    // Store metadata (in Phase 2, this will be persisted)
    const metadata: EpochMetadata = {
      reason,
      initiatedBy,
    };

    // Update state
    this.epochs.set(newEpochNumber, newEpoch);
    this._currentEpoch = newEpoch;

    return newEpoch;
  }

  getEpochHistory(): ReadonlyArray<Epoch> {
    return Array.from(this.epochs.values()).sort(
      (a, b) => a.epochNumber - b.epochNumber
    );
  }

  isValidEpoch(epochNumber: number): boolean {
    return this.epochs.has(epochNumber);
  }

  getEpoch(epochNumber: number): Epoch | null {
    return this.epochs.get(epochNumber) ?? null;
  }

  /**
   * Creates a deterministic epoch ID based on group and epoch number
   */
  private createEpochId(epochNumber: number): EpochId {
    // Create deterministic ID from group ID and epoch number
    const idString = `${this.groupId}-epoch-${epochNumber}`;
    return createIdFromString<"Epoch">(idString) as EpochId;
  }
}

/**
 * Database-backed epoch manager that persists epochs.
 * This will be implemented in Phase 2 when we have the group schema.
 */
export class DatabaseEpochManager implements EpochManager {
  constructor(
    public readonly groupId: GroupId,
    private readonly currentEpochData: Epoch
  ) {}

  get currentEpoch(): Epoch {
    return this.currentEpochData;
  }

  getCurrentEpoch(): Epoch {
    return this.currentEpochData;
  }

  incrementEpoch(
    reason: EpochMetadata["reason"],
    initiatedBy: string
  ): Epoch {
    // Phase 2: This will actually persist to database
    throw new Error(
      "DatabaseEpochManager.incrementEpoch not implemented in Phase 1"
    );
  }

  getEpochHistory(): ReadonlyArray<Epoch> {
    // Phase 2: This will query from database
    return [this.currentEpochData];
  }

  isValidEpoch(epochNumber: number): boolean {
    // Phase 2: This will check database
    return epochNumber === this.currentEpochData.epochNumber;
  }

  getEpoch(epochNumber: number): Epoch | null {
    // Phase 2: This will query database
    if (epochNumber === this.currentEpochData.epochNumber) {
      return this.currentEpochData;
    }
    return null;
  }
}

/**
 * Factory function to create an epoch manager.
 * In Phase 1, always returns InMemoryEpochManager.
 * In Phase 2, will return DatabaseEpochManager when available.
 */
export function createEpochManager(
  groupId: GroupId,
  options?: {
    initialEpoch?: Epoch;
    type?: "memory" | "database";
    deps?: { nanoid: NanoIdLibDep };
  }
): EpochManager {
  // Phase 1: Always use in-memory
  return new InMemoryEpochManager(
    groupId, 
    options?.initialEpoch,
    options?.deps
  );
}