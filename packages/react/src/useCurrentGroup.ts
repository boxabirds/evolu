import { GroupContext, hasGroupSupport, constNull } from "@evolu/common";
import { useSyncExternalStore } from "react";
import { useEvolu } from "./useEvolu.js";

/**
 * Subscribe to current group context changes.
 * 
 * Returns the current group context, or null if no group is selected
 * or if groups are not supported.
 * 
 * ### Example
 * 
 * ```tsx
 * const MyComponent = () => {
 *   const currentGroup = useCurrentGroup();
 *   
 *   if (currentGroup) {
 *     return <div>Current group: {currentGroup.groupId}</div>;
 *   }
 *   
 *   return <div>No group selected</div>;
 * };
 * ```
 */
export const useCurrentGroup = (): GroupContext | null => {
  const evolu = useEvolu();
  
  if (!hasGroupSupport(evolu)) {
    return null;
  }
  
  return useSyncExternalStore(
    evolu.subscribeCurrentGroup,
    evolu.getCurrentGroup,
    constNull,
  );
};