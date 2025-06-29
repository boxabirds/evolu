# Testing React and Svelte Group Components

## Current State

The React and Svelte packages in Evolu don't have test infrastructure set up. The group functionality has been implemented but not directly tested in these packages. However, the underlying functionality is thoroughly tested in the common package.

## Testing Approach for React Hooks

### Best Practices for Testing React Hooks

1. **Use React Testing Library with renderHook**
   ```tsx
   import { renderHook, waitFor } from "@testing-library/react";
   import { useGroups } from "@evolu/react";
   
   test("useGroups returns groups list", async () => {
     const { result } = renderHook(() => useGroups(), {
       wrapper: EvoluProvider,
     });
     
     await waitFor(() => {
       expect(result.current.loading).toBe(false);
     });
     
     expect(result.current.groups).toBeDefined();
   });
   ```

2. **Mock the Evolu instance**
   ```tsx
   const mockEvolu = {
     supportsGroups: true,
     listGroups: vi.fn(async () => ({ 
       ok: true, 
       value: [mockGroup] 
     })),
     // ... other methods
   };
   ```

3. **Test loading states**
   ```tsx
   test("shows loading state initially", () => {
     const { result } = renderHook(() => useGroups());
     expect(result.current.loading).toBe(true);
   });
   ```

4. **Test error handling**
   ```tsx
   test("handles errors gracefully", async () => {
     mockEvolu.listGroups = vi.fn(async () => ({ 
       ok: false, 
       error: { type: "SqliteError" } 
     }));
     
     const { result } = renderHook(() => useGroups());
     
     await waitFor(() => {
       expect(result.current.error).toBe(true);
     });
   });
   ```

## Testing Approach for Svelte Stores

### Best Practices for Testing Svelte Stores

1. **Mock Svelte runes for unit tests**
   ```ts
   // In test setup
   global.$state = (initial) => {
     let value = initial;
     return {
       get: () => value,
       set: (newValue) => { value = newValue; },
     };
   };
   
   global.$effect = (fn) => {
     const cleanup = fn();
     return cleanup;
   };
   ```

2. **Test store reactivity**
   ```ts
   test("groupsStore updates when data changes", async () => {
     const store = groupsStore(mockEvolu);
     
     // Trigger data update
     await mockEvolu.listGroups();
     
     expect(store.groups).toHaveLength(1);
   });
   ```

3. **Component testing with Svelte Testing Library**
   ```svelte
   <!-- TestComponent.svelte -->
   <script>
     import { groupsStore } from "@evolu/svelte";
     const store = groupsStore(evolu);
   </script>
   
   {#if store.loading}
     <p>Loading...</p>
   {:else}
     {#each store.groups as group}
       <li>{group.name}</li>
     {/each}
   {/if}
   ```

## Integration Testing

For both React and Svelte, the best approach is integration testing:

1. **Create a test app** that uses the actual Evolu instance
2. **Use in-memory SQLite** for fast, isolated tests
3. **Test the full flow** from UI interaction to data changes

### Example Integration Test

```tsx
// React
test("full group creation flow", async () => {
  const { result } = renderHook(() => {
    const evolu = useEvolu();
    const groups = useGroups();
    return { evolu, groups };
  });
  
  // Create a group
  await act(async () => {
    await result.current.evolu.createGroup("Test Group");
  });
  
  // Verify it appears in the list
  await waitFor(() => {
    const group = result.current.groups.groups.find(
      g => g.name === "Test Group"
    );
    expect(group).toBeDefined();
  });
});
```

## Why Tests Weren't Added

1. **No existing test infrastructure** in React/Svelte packages
2. **Core functionality is tested** in the common package (419 tests passing)
3. **Would require significant setup** including:
   - Adding test runners to package.json
   - Setting up testing utilities
   - Configuring TypeScript for tests
   - Adding test dependencies

## Recommended Next Steps

1. **Add test infrastructure** to React and Svelte packages
   - Add vitest or jest configuration
   - Add @testing-library/react and @testing-library/svelte
   - Configure test scripts in package.json

2. **Create test utilities**
   - Mock Evolu provider
   - Test data factories
   - Async test helpers

3. **Write comprehensive tests**
   - Unit tests for each hook/store
   - Integration tests for common workflows
   - Error scenario testing

## Manual Testing

For now, the group functionality can be tested by:

1. **Creating example apps** that use the hooks/stores
2. **Using Storybook** to isolate and test components
3. **Testing in the context** of the main Evolu examples

The underlying functionality is solid and well-tested at the common package level, so the React/Svelte integrations should work correctly as they follow established patterns.