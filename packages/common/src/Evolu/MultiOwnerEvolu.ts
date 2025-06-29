/**
 * Multi-Owner Extensions for Core Evolu
 * 
 * This module extends the core Evolu instance with multi-owner capabilities.
 * This is the foundation that Groups will build upon.
 */

import { err, ok, Result } from "../Result.js";
import { SqliteDep, sql } from "../Sqlite.js";
import { TimeDep } from "../Time.js";
import { NanoIdLibDep } from "../NanoId.js";
import { 
  EvoluSchema, 
  MutationKind,
  MutationOptions,
} from "./Schema.js";
import { AppOwner, OwnerId } from "./Owner.js";
import { Query, CreateQuery } from "./Query.js";
import { 
  AnyOwner,
  MultiOwnerEvolu,
  MultiOwnerMutation,
  MultiOwnerCreateQuery,
  MultiOwnerQueryOptions,
  OwnerManager,
  MultiOwnerConfig,
  getOwnerId,
} from "./MultiOwnerAPI.js";
import { 
  OwnerManagerImpl, 
  resolveMutationOwner,
  filterByOwner,
  ownerToBinaryId,
  applyMultiOwnerConfig as applyMultiOwnerConfigImpl,
} from "./MultiOwnerImpl.js";

/**
 * Creates multi-owner extensions for an Evolu instance
 */
export const createMultiOwnerEvolu = <S extends EvoluSchema>(
  deps: SqliteDep & TimeDep & NanoIdLibDep,
  baseEvolu: any, // The core Evolu instance
  appOwner: AppOwner,
  config: MultiOwnerConfig = { enabled: false },
): MultiOwnerEvolu<S> => {
  
  const ownerManager = new OwnerManagerImpl(deps, appOwner);

  // Apply initial configuration
  if (config.enabled) {
    const configResult = applyMultiOwnerConfigImpl(deps, config, ownerManager);
    if (!configResult.ok) {
      throw new Error(`Failed to apply multi-owner config: ${configResult.error.type}`);
    }
  }

  /**
   * Multi-owner aware insert operation
   */
  const insert: MultiOwnerMutation<S, "insert"> = (table, props, options = {}) => {
    if (!config.enabled) {
      // Fall back to base implementation when multi-owner is disabled
      return baseEvolu.insert(table, props, options);
    }

    const owner = resolveMutationOwner(ownerManager, options.owner);
    
    // Add ownerId to the mutation options for the base implementation
    const enhancedOptions: MutationOptions = {
      ...options,
      owner,
    };

    return baseEvolu.insert(table, props, enhancedOptions);
  };

  /**
   * Multi-owner aware update operation
   */
  const update: MultiOwnerMutation<S, "update"> = (table, props, options = {}) => {
    if (!config.enabled) {
      return baseEvolu.update(table, props, options);
    }

    const owner = resolveMutationOwner(ownerManager, options.owner);
    
    const enhancedOptions: MutationOptions = {
      ...options,
      owner,
    };

    return baseEvolu.update(table, props, enhancedOptions);
  };

  /**
   * Multi-owner aware upsert operation
   */
  const upsert: MultiOwnerMutation<S, "upsert"> = (table, props, options = {}) => {
    if (!config.enabled) {
      return baseEvolu.upsert(table, props, options);
    }

    const owner = resolveMutationOwner(ownerManager, options.owner);
    
    const enhancedOptions: MutationOptions = {
      ...options,
      owner,
    };

    return baseEvolu.upsert(table, props, enhancedOptions);
  };

  /**
   * Multi-owner aware query creation
   */
  const createQuery: MultiOwnerCreateQuery<S> = (queryCallback, options = {}) => {
    if (!config.enabled || (!options.owner && !options.includeAllOwners)) {
      // Fall back to base implementation
      return baseEvolu.createQuery(queryCallback);
    }

    // Determine which owners to include
    let ownerIds: ReadonlyArray<OwnerId>;
    
    if (options.includeAllOwners) {
      ownerIds = ownerManager.listOwners().map(entry => getOwnerId(entry.owner));
    } else if (Array.isArray(options.owner)) {
      ownerIds = options.owner.map(getOwnerId);
    } else if (options.owner) {
      ownerIds = [getOwnerId(options.owner)];
    } else {
      ownerIds = [getOwnerId(ownerManager.getActiveOwner())];
    }

    // Create enhanced query with owner filtering
    const enhancedQueryCallback = (db: any) => {
      const baseQuery = queryCallback(db);
      
      // If we have multiple owners or need filtering, add WHERE clause
      if (ownerIds.length > 0) {
        const ownerFilter = filterByOwner(ownerIds);
        return baseQuery.where(sql`${ownerFilter}`);
      }
      
      return baseQuery;
    };

    return baseEvolu.createQuery(enhancedQueryCallback);
  };

  return {
    insert,
    update,
    upsert,
    createQuery,
    owners: ownerManager,
  };
};


/**
 * Type guard to check if an Evolu instance has multi-owner capabilities
 */
export const hasMultiOwnerSupport = <S extends EvoluSchema>(
  evolu: any,
): evolu is MultiOwnerEvolu<S> => {
  return evolu && typeof evolu.owners === "object";
};

/**
 * Helper to create a data owner from an owner ID
 * This is the low-level primitive that Groups will use
 */
export const createDataOwner = (ownerId: OwnerId): import("./MultiOwnerAPI.js").DataOwner => ({
  type: "group",
  id: ownerId,
});

/**
 * Helper to check if a table has multi-owner support (ownerId column)
 */
export const tableSupportsMultiOwner = (
  deps: SqliteDep,
  tableName: string,
): boolean => {
  const result = deps.sqlite.exec(sql`
    pragma table_info(${tableName});
  `);
  
  if (!result.ok) {
    return false;
  }
  
  return result.value.rows.some((row: any) => row.name === "ownerId");
};