import {
  SecurityContext,
  SecurityContextType,
  SecurityMetadata,
} from "./SecurityAbstractions.js";
import type { GroupId, GroupRole } from "./GroupTypes.js";
import type { EvoluDeps } from "./EvoluDeps.js";

/**
 * Security context for group operations.
 * 
 * This context generates NodeIds and partition keys that are scoped to a specific
 * group and epoch, ensuring that data from different groups or epochs remains
 * isolated and that group members can be identified by their NodeIds.
 */
export class GroupSecurityContext implements SecurityContext {
  readonly type: SecurityContextType = "group";
  readonly id: string;
  readonly metadata: SecurityMetadata;

  constructor(
    private readonly group: {
      id: GroupId;
      currentEpoch: number;
      name: string;
    },
    private readonly memberId: string,
    private readonly memberRole: GroupRole,
    private readonly deps: Pick<EvoluDeps, "nanoid">
  ) {
    // Context ID includes group ID and epoch for uniqueness
    this.id = `group:${group.id}:${group.currentEpoch}`;
    
    // Metadata stores all relevant group information
    this.metadata = {
      type: "group",
      groupId: group.id,
      groupName: group.name,
      epoch: group.currentEpoch,
      memberId: this.memberId,
      memberRole: this.memberRole,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Creates a unique NodeId for this group context.
   * 
   * The NodeId format is: g{groupPrefix}-e{epoch}-m{memberPrefix}-{timestamp}-{random}
   * This ensures:
   * - NodeIds are unique within and across groups
   * - Group and member can be identified from NodeId
   * - Epoch is encoded to prevent cross-epoch conflicts
   * - Timestamp provides ordering information
   */
  createNodeId(): string {
    const timestamp = Date.now().toString(36);
    
    // Take last 6 chars of group ID for prefix
    const groupPrefix = String(this.group.id).slice(-6);
    
    // Encode epoch number in base36 for compactness
    const epochStr = this.group.currentEpoch.toString(36).padStart(2, "0");
    
    // Take first 4 chars of member ID
    const memberPrefix = this.memberId.slice(0, 4);
    
    // Add random component for uniqueness
    const random = this.deps.nanoid(6);
    
    // Combine all parts into a unique NodeId
    return `g${groupPrefix}-e${epochStr}-m${memberPrefix}-${timestamp}-${random}`;
  }

  /**
   * Gets the partition key for data isolation.
   * 
   * Format: group:{groupId}:{epoch}
   * This ensures:
   * - Data from different groups is isolated
   * - Data from different epochs within a group is isolated
   * - Queries can efficiently filter by group and epoch
   */
  getPartitionKey(): string {
    return `group:${this.group.id}:${this.group.currentEpoch}`;
  }

  /**
   * Validates if a NodeId belongs to this security context.
   * This is useful for checking if a timestamp or change belongs to this group.
   */
  isValidNodeId(nodeId: string): boolean {
    if (!nodeId.startsWith("g")) return false;
    
    try {
      // Parse the NodeId components
      const parts = nodeId.split("-");
      if (parts.length !== 5) return false;
      
      const [gPrefix, ePrefix, mPrefix, _timestamp, _random] = parts;
      
      // Check group prefix matches
      const groupPrefix = String(this.group.id).slice(-6);
      if (gPrefix !== `g${groupPrefix}`) return false;
      
      // Check epoch matches
      const epochStr = this.group.currentEpoch.toString(36).padStart(2, "0");
      if (ePrefix !== `e${epochStr}`) return false;
      
      // NodeId is valid for this context
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extracts member information from a NodeId.
   * Returns the member prefix that was encoded in the NodeId.
   */
  getMemberFromNodeId(nodeId: string): string | null {
    if (!this.isValidNodeId(nodeId)) return null;
    
    try {
      const parts = nodeId.split("-");
      const memberPrefix = parts[2]; // m{memberPrefix}
      return memberPrefix.substring(1); // Remove 'm' prefix
    } catch {
      return null;
    }
  }

  /**
   * Creates a deterministic context ID for comparison.
   * Two contexts with the same group ID and epoch will have the same context ID.
   */
  static createContextId(groupId: GroupId, epoch: number): string {
    return `group:${groupId}:${epoch}`;
  }

  /**
   * Checks if this context has sufficient permissions for an operation.
   */
  hasPermission(requiredRole: GroupRole): boolean {
    if (requiredRole === "member") {
      // Both admin and member have member permissions
      return true;
    }
    // Only admin has admin permissions
    return this.memberRole === "admin";
  }

  /**
   * Creates a display string for logging/debugging.
   */
  toString(): string {
    return `GroupSecurityContext(group=${this.group.name}, epoch=${this.group.currentEpoch}, member=${this.memberId}, role=${this.memberRole})`;
  }
}

/**
 * Creates a new GroupSecurityContext.
 */
export const createGroupSecurityContext = (
  group: {
    id: GroupId;
    currentEpoch: number;
    name: string;
  },
  memberId: string,
  memberRole: GroupRole,
  deps: Pick<EvoluDeps, "nanoid">
): GroupSecurityContext => {
  return new GroupSecurityContext(group, memberId, memberRole, deps);
};