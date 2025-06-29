import { AuthProvider, AuthProof } from "./SecurityAbstractions.js";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

export type GroupRole = "admin" | "member";

export interface GroupMember {
  readonly userId: string;
  readonly role: GroupRole;
  readonly publicKey: Uint8Array;
  readonly joinedAt: string;
}

export interface GroupAuthProvider extends AuthProvider {
  readonly groupId: string;
  readonly members: ReadonlyArray<GroupMember>;
  
  addMember(member: GroupMember): void;
  removeMember(userId: string): void;
  getMemberRole(userId: string): GroupRole | null;
  canPerformAction(userId: string, action: string): boolean;
}

export class SimpleGroupAuthProvider implements GroupAuthProvider {
  private _members: Map<string, GroupMember>;
  
  constructor(
    public readonly groupId: string,
    public readonly currentUserId: string,
    initialMembers: GroupMember[] = []
  ) {
    this._members = new Map(initialMembers.map(m => [m.userId, m]));
  }
  
  get members(): ReadonlyArray<GroupMember> {
    return Array.from(this._members.values());
  }
  
  async createAuthProof(message: Uint8Array): Promise<AuthProof> {
    // In Phase 1, we create a simple proof
    // Phase 2 will implement proper signatures
    const member = this._members.get(this.currentUserId);
    if (!member) {
      throw new Error(`User ${this.currentUserId} is not a member of group ${this.groupId}`);
    }
    
    // Create a hash of the message with user context
    const contextMessage = new Uint8Array([
      ...message,
      ...new TextEncoder().encode(this.groupId),
      ...new TextEncoder().encode(this.currentUserId),
      ...new TextEncoder().encode(member.role),
    ]);
    
    const hash = sha256(contextMessage);
    
    // Create metadata as binary data
    const metadata = JSON.stringify({
      groupId: this.groupId,
      userId: this.currentUserId,
      role: member.role,
      timestamp: new Date().toISOString(),
    });
    
    // Combine hash and metadata into data field
    const metadataBytes = new TextEncoder().encode(metadata);
    const data = new Uint8Array(hash.length + metadataBytes.length);
    data.set(hash, 0);
    data.set(metadataBytes, hash.length);
    
    return {
      type: "group-signature",
      data,
    };
  }
  
  async verifyAuthProof(message: Uint8Array, proof: AuthProof): Promise<boolean> {
    if (proof.type !== "group-signature") {
      return false;
    }
    
    // Extract hash and metadata from data
    const hashLength = 32; // SHA-256 produces 32 bytes
    if (proof.data.length < hashLength) {
      return false;
    }
    
    const proofHash = proof.data.slice(0, hashLength);
    const metadataBytes = proof.data.slice(hashLength);
    
    let metadata: {
      groupId: string;
      userId: string;
      role: string;
      timestamp: string;
    };
    
    try {
      const metadataString = new TextDecoder().decode(metadataBytes);
      metadata = JSON.parse(metadataString);
    } catch {
      return false;
    }
    
    // Verify the user is a member
    const member = this._members.get(metadata.userId);
    if (!member || member.role !== metadata.role) {
      return false;
    }
    
    // Verify the proof matches
    const contextMessage = new Uint8Array([
      ...message,
      ...new TextEncoder().encode(metadata.groupId),
      ...new TextEncoder().encode(metadata.userId),
      ...new TextEncoder().encode(metadata.role),
    ]);
    
    const expectedHash = sha256(contextMessage);
    
    // Compare hashes
    if (proofHash.length !== expectedHash.length) {
      return false;
    }
    
    for (let i = 0; i < proofHash.length; i++) {
      if (proofHash[i] !== expectedHash[i]) {
        return false;
      }
    }
    
    return true;
  }
  
  addMember(member: GroupMember): void {
    this._members.set(member.userId, member);
  }
  
  removeMember(userId: string): void {
    this._members.delete(userId);
  }
  
  getMemberRole(userId: string): GroupRole | null {
    const member = this._members.get(userId);
    return member?.role ?? null;
  }
  
  canPerformAction(userId: string, action: string): boolean {
    const role = this.getMemberRole(userId);
    if (!role) return false;
    
    // Simple role-based permissions
    const adminActions = ["addMember", "removeMember", "rotateEpoch", "deleteGroup"];
    const memberActions = ["read", "write", "invite"];
    
    if (role === "admin") {
      return true; // Admins can do everything
    }
    
    return memberActions.includes(action);
  }
}

// Factory function
export const createGroupAuthProvider = (
  groupId: string,
  currentUserId: string,
  initialMembers?: GroupMember[]
): GroupAuthProvider => {
  return new SimpleGroupAuthProvider(groupId, currentUserId, initialMembers);
};