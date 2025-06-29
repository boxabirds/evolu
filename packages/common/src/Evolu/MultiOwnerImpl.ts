/**
 * Implementation of Multi-Owner API functionality
 */

import { err, ok, Result } from "../Result.js";
import { SqliteDep, SqliteError, sql } from "../Sqlite.js";
import { TimeDep } from "../Time.js";
import { NanoIdLibDep } from "../NanoId.js";
import { AppOwner, OwnerId } from "./Owner.js";
import { 
  AnyOwner, 
  DataOwner, 
  OwnerManager, 
  OwnerError,
  MultiOwnerConfig,
  OwnerContext,
  isAppOwner,
  isDataOwner,
  getOwnerId,
} from "./MultiOwnerAPI.js";

/**
 * Implementation of the OwnerManager interface
 */
export class OwnerManagerImpl implements OwnerManager {
  private activeOwner: AnyOwner;

  constructor(
    private readonly deps: SqliteDep & TimeDep & NanoIdLibDep,
    private readonly appOwner: AppOwner,
  ) {
    this.activeOwner = appOwner;
  }

  getAppOwner(): AppOwner {
    return this.appOwner;
  }

  addDataOwner(ownerId: OwnerId): Result<DataOwner, OwnerError> {
    // Check if owner already exists
    const existing = this.findOwnerById(ownerId);
    if (existing) {
      return err({ type: "OwnerAlreadyExists", ownerId });
    }

    // Validate ownerId format
    if (!ownerId || typeof ownerId !== "string" || ownerId.trim() === "") {
      return err({ type: "InvalidOwnerId", ownerId });
    }

    const dataOwner: DataOwner = {
      type: "group",
      id: ownerId,
    };

    // Add to database
    const timestamp = this.deps.time.now();
    const result = this.deps.sqlite.exec(sql`
      insert into evolu_owner (id, type, createdAt, timestamp)
      values (${ownerId}, 'group', ${timestamp}, ${timestamp});
    `);

    if (!result.ok) {
      return err({ type: "DatabaseError", error: result.error });
    }

    return ok(dataOwner);
  }

  listOwners(): ReadonlyArray<{
    readonly owner: AnyOwner;
    readonly addedAt: string;
    readonly isActive: boolean;
  }> {
    const result = this.deps.sqlite.exec<{
      id: OwnerId;
      type: "app" | "group";
      createdAt: string;
    }>(sql`
      select id, type, createdAt 
      from evolu_owner 
      order by createdAt asc;
    `);

    if (!result.ok) {
      // Fallback to just the app owner if database query fails
      return [{
        owner: this.appOwner,
        addedAt: this.appOwner.createdAt,
        isActive: getOwnerId(this.activeOwner) === getOwnerId(this.appOwner),
      }];
    }

    return result.value.rows.map(row => {
      const owner: AnyOwner = row.type === "app" 
        ? this.appOwner
        : { type: "group", id: row.id };

      return {
        owner,
        addedAt: row.createdAt,
        isActive: getOwnerId(this.activeOwner) === getOwnerId(owner),
      };
    });
  }

  setActiveOwner(owner: AnyOwner): void {
    // Verify the owner exists in our database
    if (!this.findOwnerById(getOwnerId(owner))) {
      throw new Error(`Owner ${getOwnerId(owner)} not found in database`);
    }
    this.activeOwner = owner;
  }

  getActiveOwner(): AnyOwner {
    return this.activeOwner;
  }

  removeDataOwner(owner: DataOwner): Result<void, OwnerError> {
    // Cannot remove app owner
    if (isAppOwner(owner)) {
      return err({ type: "CannotRemoveAppOwner" });
    }

    // Cannot remove active owner
    if (getOwnerId(owner) === getOwnerId(this.activeOwner)) {
      return err({ type: "CannotRemoveActiveOwner" });
    }

    // Check if owner exists
    if (!this.findOwnerById(owner.id)) {
      return err({ type: "OwnerNotFound", ownerId: owner.id });
    }

    // Remove from database
    const result = this.deps.sqlite.exec(sql`
      delete from evolu_owner where id = ${owner.id} and type = 'group';
    `);

    if (!result.ok) {
      return err({ type: "DatabaseError", error: result.error });
    }

    return ok();
  }

  /**
   * Helper to find an owner by ID in the database
   */
  private findOwnerById(ownerId: OwnerId): AnyOwner | null {
    const owners = this.listOwners();
    const found = owners.find(entry => getOwnerId(entry.owner) === ownerId);
    return found ? found.owner : null;
  }
}

/**
 * Creates an OwnerContext for the current session
 */
export const createOwnerContext = (
  deps: SqliteDep,
  ownerManager: OwnerManager,
): OwnerContext => {
  const availableOwners = ownerManager.listOwners().map(entry => entry.owner);
  
  return {
    currentOwner: ownerManager.getActiveOwner(),
    availableOwners,
    canCreateDataOwners: true, // Groups will implement this properly
    canAddDataOwners: true,    // Groups will implement this properly
  };
};

/**
 * Applies multi-owner configuration during database initialization
 */
export const applyMultiOwnerConfig = (
  deps: SqliteDep & TimeDep & NanoIdLibDep,
  config: MultiOwnerConfig,
  ownerManager: OwnerManager,
): Result<void, OwnerError> => {
  if (!config.enabled) {
    return ok();
  }

  // Register initial data owners
  if (config.initialDataOwners) {
    for (const ownerId of config.initialDataOwners) {
      const result = ownerManager.addDataOwner(ownerId);
      if (!result.ok && result.error.type !== "OwnerAlreadyExists") {
        return result;
      }
    }
  }

  // Set default owner if specified
  if (config.defaultOwner && config.defaultOwner !== "app") {
    ownerManager.setActiveOwner(config.defaultOwner);
  }

  return ok();
};

/**
 * Resolves the owner for a mutation, using the active owner as fallback
 */
export const resolveMutationOwner = (
  ownerManager: OwnerManager,
  specifiedOwner?: AnyOwner,
): AnyOwner => {
  return specifiedOwner || ownerManager.getActiveOwner();
};

/**
 * Filters data by owner for queries
 * This is a foundation function that Groups will extend
 */
export const filterByOwner = (
  ownerIds: ReadonlyArray<OwnerId>,
): string => {
  if (ownerIds.length === 1) {
    return `ownerId = cast('${ownerIds[0]}' as blob)`;
  }
  
  const ownerIdClauses = ownerIds
    .map(id => `cast('${id}' as blob)`)
    .join(', ');
  
  return `ownerId IN (${ownerIdClauses})`;
};

/**
 * Helper to convert an owner to binary format for database storage
 */
export const ownerToBinaryId = (owner: AnyOwner): Uint8Array => {
  const ownerId = getOwnerId(owner);
  return new TextEncoder().encode(ownerId);
};