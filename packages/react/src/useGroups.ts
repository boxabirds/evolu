import { Group, hasGroupSupport } from "@evolu/common";
import { useEffect, useState } from "react";
import { useEvolu } from "./useEvolu.js";

/**
 * Hook to get all groups the current user is a member of.
 * 
 * This hook fetches the list of groups asynchronously and updates
 * when the user's group membership changes.
 * 
 * ### Example
 * 
 * ```tsx
 * const MyGroupList = () => {
 *   const { groups, loading, error } = useGroups();
 *   
 *   if (loading) return <div>Loading groups...</div>;
 *   if (error) return <div>Error loading groups</div>;
 *   
 *   return (
 *     <ul>
 *       {groups.map(group => (
 *         <li key={group.id}>{group.name}</li>
 *       ))}
 *     </ul>
 *   );
 * };
 * ```
 */
export const useGroups = (): {
  groups: ReadonlyArray<Group>;
  loading: boolean;
  error: boolean;
} => {
  const evolu = useEvolu();
  const [groups, setGroups] = useState<ReadonlyArray<Group>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!hasGroupSupport(evolu)) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadGroups = async () => {
      setLoading(true);
      setError(false);
      
      try {
        const result = await evolu.listGroups();
        
        if (!cancelled) {
          if (result.ok) {
            setGroups(result.value);
          } else {
            setError(true);
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    loadGroups();

    // TODO: In Phase 2, subscribe to group membership changes
    // For now, reload when component mounts

    return () => {
      cancelled = true;
    };
  }, [evolu]);

  return { groups, loading, error };
};