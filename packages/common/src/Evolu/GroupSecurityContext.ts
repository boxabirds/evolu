import type { SecurityContext } from "./SecurityAbstractions.js";
import type { NodeId } from "./Timestamp.js";
import { EpochManager } from "./EpochManager.js";
import { nanoid } from "nanoid";

export interface Group {
  readonly id: string;
  readonly name: string;
  readonly currentEpoch: number;
  readonly createdAt: string;
  readonly createdBy: string;
}

export interface GroupSecurityContext extends SecurityContext {
  readonly type: "group";
  readonly group: Group;
  readonly epochManager: EpochManager;
}

export const createGroupSecurityContext = (
  group: Group,
  epochManager: EpochManager
): GroupSecurityContext => {
  return {
    type: "group",
    id: group.id,
    
    group,
    epochManager,
    
    createNodeId(): NodeId {
      // Generate a unique NodeId for this group and epoch
      // NodeId must be a 16-character hex string
      const source = `${group.id}-${epochManager.currentEpoch}-${Date.now()}-${nanoid(6)}`;
      
      // Simple hash function to convert to hex
      let hash = 0;
      for (let i = 0; i < source.length; i++) {
        const char = source.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      // Add some randomness to avoid collisions
      const random = Math.floor(Math.random() * 0xFFFFFF);
      const combined = Math.abs(hash + random);
      
      // Convert to hex and ensure it's exactly 16 characters
      return combined.toString(16).padStart(16, '0').slice(0, 16) as NodeId;
    },
    
    getPartitionKey(): string {
      return `group:${group.id}:${epochManager.currentEpoch}`;
    },
    
    metadata: {
      groupName: group.name,
      epoch: epochManager.currentEpoch,
      createdBy: group.createdBy,
    },
  };
};

export const createGroup = (
  name: string,
  createdBy: string
): Group => {
  return {
    id: nanoid(16),
    name,
    currentEpoch: 1,
    createdAt: new Date().toISOString(),
    createdBy,
  };
};