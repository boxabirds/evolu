/**
 * Multi-Owner API Extensions for Evolu
 * 
 * This module extends the core Evolu API to support multiple owners
 * in a single database. This is the foundation that Groups will build on.
 */

import { Result } from "../Result.js";
import { Mnemonic } from "../Type.js";
import { 
  AppOwner, 
  OwnerId,
  OwnerWithWriteAccess,
} from "./Owner.js";
import { 
  EvoluSchema, 
  MutationKind,
  MutationOptions as BaseMutationOptions,
  Mutation as BaseMutation,
} from "./Schema.js";
import type { Query } from "./Query.js";

/**
 * A simple owner identifier that represents any data owner in the system.
 * This is the foundation - Groups will add additional metadata on top.
 */
export interface DataOwner {
  readonly type: "app" | "group";
  readonly id: OwnerId;
  readonly writeKey?: Uint8Array;
}

/**
 * Union type for all supported owner types
 */
export type AnyOwner = AppOwner | DataOwner;

/**
 * Extended mutation options that support multi-owner operations
 */
export interface MultiOwnerMutationOptions extends BaseMutationOptions {
  /**
   * Specify which owner should own the created/updated data.
   * If not specified, defaults to the current active owner (app owner).
   */
  readonly owner?: AnyOwner;
}

/**
 * Extended mutation function that supports owner specification
 */
export type MultiOwnerMutation<S extends EvoluSchema, Kind extends MutationKind> = <
  TableName extends keyof S,
>(
  table: TableName,
  props: Parameters<BaseMutation<S, Kind>>[1],
  options?: MultiOwnerMutationOptions,
) => ReturnType<BaseMutation<S, Kind>>;

/**
 * Query options for multi-owner scenarios
 */
export interface MultiOwnerQueryOptions {
  /**
   * Filter query results to specific owner(s).
   * If not specified, uses the current active owner.
   */
  readonly owner?: AnyOwner | ReadonlyArray<AnyOwner>;
  
  /**
   * Whether to include data from all owners the user has access to.
   * When true, ignores the owner parameter.
   */
  readonly includeAllOwners?: boolean;
}

/**
 * Extended query creation function that supports owner filtering
 */
export interface MultiOwnerCreateQuery<S extends EvoluSchema> {
  <T extends import("./Query.js").Row>(
    queryCallback: (db: any) => Query<T>,
    options?: MultiOwnerQueryOptions,
  ): Query<T>;
}

/**
 * Owner management interface for the multi-owner foundation
 * Groups will extend this with additional functionality
 */
export interface OwnerManager {
  /**
   * Get the current app owner (the primary owner for this device/user)
   */
  getAppOwner(): AppOwner;
  
  /**
   * Register a new data owner in the database
   * This is a low-level operation - Groups will provide higher-level APIs
   */
  addDataOwner(ownerId: OwnerId): Result<DataOwner, OwnerError>;
  
  /**
   * List all owners currently available in this database
   */
  listOwners(): ReadonlyArray<{
    readonly owner: AnyOwner;
    readonly addedAt: string;
    readonly isActive: boolean;
  }>;
  
  /**
   * Set the active owner context for operations
   * When set, mutations and queries will default to this owner
   */
  setActiveOwner(owner: AnyOwner): void;
  
  /**
   * Get the currently active owner
   */
  getActiveOwner(): AnyOwner;
  
  /**
   * Remove a data owner from this database
   * This will not delete the data, but will prevent future access
   */
  removeDataOwner(owner: DataOwner): Result<void, OwnerError>;
}

/**
 * Errors that can occur during owner operations
 */
export type OwnerError = 
  | { readonly type: "OwnerAlreadyExists"; readonly ownerId: OwnerId }
  | { readonly type: "OwnerNotFound"; readonly ownerId: OwnerId }
  | { readonly type: "CannotRemoveAppOwner" }
  | { readonly type: "CannotRemoveActiveOwner" }
  | { readonly type: "InvalidOwnerId"; readonly ownerId: string }
  | { readonly type: "DatabaseError"; readonly error: unknown };

/**
 * Extended Evolu interface that includes multi-owner capabilities
 */
export interface MultiOwnerEvolu<S extends EvoluSchema> {
  /**
   * Multi-owner aware insert operation
   */
  insert: MultiOwnerMutation<S, "insert">;
  
  /**
   * Multi-owner aware update operation  
   */
  update: MultiOwnerMutation<S, "update">;
  
  /**
   * Multi-owner aware upsert operation
   */
  upsert: MultiOwnerMutation<S, "upsert">;
  
  /**
   * Multi-owner aware query creation
   */
  createQuery: MultiOwnerCreateQuery<S>;
  
  /**
   * Owner management operations
   */
  owners: OwnerManager;
}

/**
 * Options for enabling multi-owner mode in Evolu
 */
export interface MultiOwnerConfig {
  /**
   * Enable multi-owner support.
   * When false, Evolu operates in single-owner mode (backward compatible).
   */
  readonly enabled: boolean;
  
  /**
   * Initial data owners to register when initializing the database.
   * Useful for restoring access to multi-owner data.
   */
  readonly initialDataOwners?: ReadonlyArray<OwnerId>;
  
  /**
   * Default owner for new mutations when no owner is specified.
   * Defaults to app owner.
   */
  readonly defaultOwner?: "app" | DataOwner;
}

/**
 * Context information for the current owner session
 */
export interface OwnerContext {
  readonly currentOwner: AnyOwner;
  readonly availableOwners: ReadonlyArray<AnyOwner>;
  readonly canCreateDataOwners: boolean;
  readonly canAddDataOwners: boolean;
}

/**
 * Statistics about multi-owner data distribution
 */
export interface MultiOwnerStats {
  readonly totalOwners: number;
  readonly dataByOwner: ReadonlyArray<{
    readonly owner: AnyOwner;
    readonly rowCount: number;
    readonly tableStats: ReadonlyArray<{
      readonly tableName: string;
      readonly rowCount: number;
    }>;
  }>;
}

/**
 * Type guard to check if an owner is a DataOwner
 */
export const isDataOwner = (owner: AnyOwner): owner is DataOwner =>
  owner.type === "group";

/**
 * Type guard to check if an owner is an AppOwner  
 */
export const isAppOwner = (owner: AnyOwner): owner is AppOwner =>
  owner.type === "AppOwner";

/**
 * Helper to extract owner ID from any owner type
 */
export const getOwnerId = (owner: AnyOwner): OwnerId => owner.id;

/**
 * Helper to check if two owners are the same
 */
export const ownersEqual = (a: AnyOwner, b: AnyOwner): boolean =>
  a.id === b.id && a.type === b.type;