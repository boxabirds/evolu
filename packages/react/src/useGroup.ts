import { GroupWithMembers, GroupId, hasGroupSupport } from "@evolu/common";
import { useEffect, useState } from "react";
import { useEvolu } from "./useEvolu.js";

/**
 * Hook to get a specific group by ID with all its details.
 * 
 * This hook fetches group details including members asynchronously.
 * 
 * ### Example
 * 
 * ```tsx
 * const GroupDetails = ({ groupId }: { groupId: GroupId }) => {
 *   const { group, loading, error } = useGroup(groupId);
 *   
 *   if (loading) return <div>Loading group...</div>;
 *   if (error) return <div>Error loading group</div>;
 *   if (!group) return <div>Group not found</div>;
 *   
 *   return (
 *     <div>
 *       <h2>{group.name}</h2>
 *       <p>Members: {group.members.length}</p>
 *     </div>
 *   );
 * };
 * ```
 */
export const useGroup = (
  groupId: GroupId
): {
  group: GroupWithMembers | null;
  loading: boolean;
  error: boolean;
} => {
  const evolu = useEvolu();
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!hasGroupSupport(evolu)) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadGroup = async () => {
      setLoading(true);
      setError(false);
      
      try {
        const result = await evolu.getGroup(groupId);
        
        if (!cancelled) {
          if (result.ok) {
            setGroup(result.value);
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

    loadGroup();

    // TODO: In Phase 2, subscribe to group changes
    // For now, reload when groupId changes

    return () => {
      cancelled = true;
    };
  }, [evolu, groupId]);

  return { group, loading, error };
};