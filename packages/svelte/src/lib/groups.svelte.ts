/**
 * Svelte stores and state management for Evolu groups.
 * This file needs to be named .svelte.ts to be recognized by the Svelte compiler.
 */

import type {
  Evolu,
  EvoluSchema,
  EvoluWithGroups,
  Group,
  GroupContext,
  GroupId,
  GroupWithMembers,
} from "@evolu/common";
import { hasGroupSupport } from "@evolu/common";

/**
 * Creates a reactive state for the current group context.
 * 
 * The state automatically updates when the current group changes.
 * 
 * ### Example
 * 
 * ```ts
 * const currentGroupState = currentGroupStore(evolu);
 * 
 * // In your component
 * {#if currentGroupState.group}
 *   <p>Current group: {currentGroupState.group.groupId}</p>
 * {:else}
 *   <p>No group selected</p>
 * {/if}
 * ```
 */
export function currentGroupStore<Schema extends EvoluSchema>(
  evolu: Evolu<Schema>
): { readonly group: GroupContext | null } {
  let writableState: GroupContext | null = $state(null);

  $effect(() => {
    if (!hasGroupSupport(evolu)) {
      return;
    }

    // Set initial value
    writableState = evolu.getCurrentGroup();

    // Subscribe to changes
    const unsubscribe = evolu.subscribeCurrentGroup(() => {
      writableState = evolu.getCurrentGroup();
    });

    return () => {
      unsubscribe();
    };
  });

  return {
    get group() {
      return writableState;
    },
  };
}

/**
 * Creates a reactive state for all groups the current user is a member of.
 * 
 * The state loads groups asynchronously and provides loading/error states.
 * 
 * ### Example
 * 
 * ```ts
 * const groupsState = groupsStore(evolu);
 * 
 * // In your component
 * {#if groupsState.loading}
 *   <p>Loading groups...</p>
 * {:else if groupsState.error}
 *   <p>Error loading groups</p>
 * {:else}
 *   {#each groupsState.groups as group}
 *     <li>{group.name}</li>
 *   {/each}
 * {/if}
 * ```
 */
export function groupsStore<Schema extends EvoluSchema>(
  evolu: Evolu<Schema>
): { 
  readonly groups: ReadonlyArray<Group>;
  readonly loading: boolean;
  readonly error: boolean;
} {
  let groups: ReadonlyArray<Group> = $state([]);
  let loading = $state(true);
  let error = $state(false);

  $effect(() => {
    if (!hasGroupSupport(evolu)) {
      loading = false;
      return;
    }

    let cancelled = false;

    const loadGroups = async () => {
      loading = true;
      error = false;

      try {
        const result = await evolu.listGroups();
        
        if (!cancelled) {
          if (result.ok) {
            groups = result.value;
          } else {
            error = true;
          }
          loading = false;
        }
      } catch {
        if (!cancelled) {
          error = true;
          loading = false;
        }
      }
    };

    loadGroups();

    // TODO: In Phase 2, subscribe to group membership changes

    return () => {
      cancelled = true;
    };
  });

  return {
    get groups() {
      return groups;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
  };
}

/**
 * Creates a reactive state for a specific group with all its details.
 * 
 * The state loads group details asynchronously including members.
 * 
 * ### Example
 * 
 * ```ts
 * let groupId = $state<GroupId>('group-123');
 * const groupState = groupStore(evolu, () => groupId);
 * 
 * // In your component
 * {#if groupState.loading}
 *   <p>Loading group...</p>
 * {:else if groupState.error}
 *   <p>Error loading group</p>
 * {:else if groupState.group}
 *   <h2>{groupState.group.name}</h2>
 *   <p>Members: {groupState.group.members.length}</p>
 * {:else}
 *   <p>Group not found</p>
 * {/if}
 * ```
 */
export function groupStore<Schema extends EvoluSchema>(
  evolu: Evolu<Schema>,
  /**
   * Can be a normal groupId or a derived groupId.
   * Svelte reactivity: it needs to be a callback.
   */
  observedGroupId: () => GroupId | undefined
): {
  readonly group: GroupWithMembers | null;
  readonly loading: boolean;
  readonly error: boolean;
} {
  let group: GroupWithMembers | null = $state(null);
  let loading = $state(true);
  let error = $state(false);

  $effect(() => {
    const groupId = observedGroupId();
    
    if (!hasGroupSupport(evolu) || !groupId) {
      loading = false;
      return;
    }

    let cancelled = false;

    const loadGroup = async () => {
      loading = true;
      error = false;

      try {
        const result = await evolu.getGroup(groupId);
        
        if (!cancelled) {
          if (result.ok) {
            group = result.value;
          } else {
            error = true;
          }
          loading = false;
        }
      } catch {
        if (!cancelled) {
          error = true;
          loading = false;
        }
      }
    };

    loadGroup();

    // TODO: In Phase 2, subscribe to group changes

    return () => {
      cancelled = true;
    };
  });

  return {
    get group() {
      return group;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
  };
}

/**
 * Creates a reactive state for group members.
 * 
 * This is a convenience store that extracts just the active members.
 * 
 * ### Example
 * 
 * ```ts
 * let groupId = $state<GroupId>('group-123');
 * const membersState = groupMembersStore(evolu, () => groupId);
 * 
 * // In your component
 * {#each membersState.members as member}
 *   <li>{member.userId} - {member.role}</li>
 * {/each}
 * ```
 */
export function groupMembersStore<Schema extends EvoluSchema>(
  evolu: Evolu<Schema>,
  observedGroupId: () => GroupId | undefined
): {
  readonly members: ReadonlyArray<GroupWithMembers["members"][number]>;
  readonly loading: boolean;
  readonly error: boolean;
} {
  const groupState = groupStore(evolu, observedGroupId);

  return {
    get members() {
      // Filter out members who have left
      return groupState.group?.members.filter(m => !m.leftAt) ?? [];
    },
    get loading() {
      return groupState.loading;
    },
    get error() {
      return groupState.error;
    },
  };
}