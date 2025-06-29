import { GroupMember, GroupId, hasGroupSupport } from "@evolu/common";
import { useEffect, useState } from "react";
import { useEvolu } from "./useEvolu.js";

/**
 * Hook to get members of a specific group.
 * 
 * This is a convenience hook that extracts just the members
 * from the group data.
 * 
 * ### Example
 * 
 * ```tsx
 * const MemberList = ({ groupId }: { groupId: GroupId }) => {
 *   const { members, loading, error } = useGroupMembers(groupId);
 *   
 *   if (loading) return <div>Loading members...</div>;
 *   if (error) return <div>Error loading members</div>;
 *   
 *   return (
 *     <ul>
 *       {members.map(member => (
 *         <li key={member.id}>
 *           {member.userId} - {member.role}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * };
 * ```
 */
export const useGroupMembers = (
  groupId: GroupId
): {
  members: ReadonlyArray<GroupMember>;
  loading: boolean;
  error: boolean;
} => {
  const evolu = useEvolu();
  const [members, setMembers] = useState<ReadonlyArray<GroupMember>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!hasGroupSupport(evolu)) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadMembers = async () => {
      setLoading(true);
      setError(false);
      
      try {
        const result = await evolu.getGroup(groupId);
        
        if (!cancelled) {
          if (result.ok && result.value) {
            // Filter out members who have left
            const activeMembers = result.value.members.filter(m => !m.leftAt);
            setMembers(activeMembers);
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

    loadMembers();

    // TODO: In Phase 2, subscribe to member changes
    // For now, reload when groupId changes

    return () => {
      cancelled = true;
    };
  }, [evolu, groupId]);

  return { members, loading, error };
};