/**
 * Group authentication provider implementing the AuthProvider interface.
 * 
 * This provider handles authentication for group contexts, including
 * multi-member signature creation and verification.
 */

import { 
  AuthProvider, 
  AuthProof, 
  BinaryData 
} from "./SecurityAbstractions.js";
import type { 
  GroupId, 
  GroupMember,
  MemberId,
  GroupRole 
} from "./GroupTypes.js";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import type { SymmetricCrypto } from "../Crypto.js";

/**
 * Metadata stored in auth proofs for group authentication
 */
interface GroupAuthMetadata {
  groupId: string;
  memberId: string;
  role: GroupRole;
  timestamp: string;
  epoch: number;
}

/**
 * Group authentication provider that handles multi-member authentication.
 * 
 * In Phase 1, this uses simplified signatures. Phase 2 will implement
 * proper cryptographic signatures using member private keys.
 */
export class GroupAuthProvider implements AuthProvider {
  private readonly memberMap: Map<string, GroupMember>;

  constructor(
    private readonly groupId: GroupId,
    private readonly currentMember: GroupMember,
    private readonly allMembers: ReadonlyArray<GroupMember>,
    private readonly currentEpoch: number,
    private readonly crypto: SymmetricCrypto
  ) {
    // Build member map for quick lookups
    this.memberMap = new Map(
      allMembers.map(m => [m.userId, m])
    );
    
    // Validate current member is in the group
    if (!this.memberMap.has(currentMember.userId)) {
      throw new Error(
        `Current member ${currentMember.userId} is not in group ${groupId}`
      );
    }
  }

  /**
   * Creates an authentication proof for a message.
   * 
   * Phase 1: Creates a hash-based proof with member metadata
   * Phase 2: Will use actual digital signatures
   */
  async createAuthProof(message: BinaryData): Promise<AuthProof> {
    // Create metadata for the proof
    const metadata: GroupAuthMetadata = {
      groupId: String(this.groupId),
      memberId: String(this.currentMember.id),
      role: this.currentMember.role,
      timestamp: new Date().toISOString(),
      epoch: this.currentEpoch,
    };

    // Create a message to sign that includes context
    const contextMessage = this.createContextMessage(message, metadata);
    
    // Phase 1: Use SHA-256 hash as simplified "signature"
    // Phase 2: Replace with actual signature using member's private key
    const signature = sha256(contextMessage);
    
    // Encode metadata
    const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
    
    // Combine signature and metadata
    const proofData = new Uint8Array(signature.length + metadataBytes.length + 4);
    const view = new DataView(proofData.buffer);
    
    // Write signature length (4 bytes)
    view.setUint32(0, signature.length, true);
    
    // Write signature
    proofData.set(signature, 4);
    
    // Write metadata
    proofData.set(metadataBytes, 4 + signature.length);
    
    return {
      type: "group-auth-v1",
      data: proofData,
    };
  }

  /**
   * Verifies an authentication proof for a message.
   * 
   * Checks that:
   * 1. The proof is from a valid group member
   * 2. The member has the claimed role
   * 3. The signature is valid
   * 4. The epoch matches (prevents replay from old epochs)
   */
  async verifyAuthProof(
    message: BinaryData, 
    proof: AuthProof
  ): Promise<boolean> {
    if (proof.type !== "group-auth-v1") {
      return false;
    }

    try {
      // Parse the proof data
      const view = new DataView(proof.data.buffer);
      const signatureLength = view.getUint32(0, true);
      
      if (proof.data.length < 4 + signatureLength) {
        return false;
      }
      
      // Extract signature and metadata
      const signature = proof.data.slice(4, 4 + signatureLength);
      const metadataBytes = proof.data.slice(4 + signatureLength);
      
      // Parse metadata
      const metadataString = new TextDecoder().decode(metadataBytes);
      const metadata: GroupAuthMetadata = JSON.parse(metadataString);
      
      // Verify group ID matches
      if (metadata.groupId !== String(this.groupId)) {
        return false;
      }
      
      // Verify epoch matches (prevents replay attacks)
      if (metadata.epoch !== this.currentEpoch) {
        return false;
      }
      
      // Find the member who created the proof
      const member = this.findMemberById(metadata.memberId);
      if (!member) {
        return false;
      }
      
      // Verify the member has the claimed role
      if (member.role !== metadata.role) {
        return false;
      }
      
      // Recreate the context message
      const contextMessage = this.createContextMessage(message, metadata);
      
      // Phase 1: Verify hash
      // Phase 2: Verify actual signature using member's public key
      const expectedSignature = sha256(contextMessage);
      
      // Compare signatures
      if (signature.length !== expectedSignature.length) {
        return false;
      }
      
      for (let i = 0; i < signature.length; i++) {
        if (signature[i] !== expectedSignature[i]) {
          return false;
        }
      }
      
      return true;
    } catch {
      // Any parsing errors mean invalid proof
      return false;
    }
  }

  /**
   * Gets the public identifier for this auth provider.
   * For groups, this includes the group ID and current epoch.
   */
  getPublicIdentifier(): string {
    return `group:${this.groupId}:${this.currentEpoch}`;
  }

  /**
   * Creates a message that includes all context for signing/verification.
   * This ensures the signature covers all relevant metadata.
   */
  private createContextMessage(
    message: BinaryData,
    metadata: GroupAuthMetadata
  ): Uint8Array {
    const encoder = new TextEncoder();
    
    // Combine all parts into a single message
    const parts = [
      message,
      encoder.encode(metadata.groupId),
      encoder.encode(metadata.memberId),
      encoder.encode(metadata.role),
      encoder.encode(metadata.timestamp),
      encoder.encode(metadata.epoch.toString()),
    ];
    
    // Calculate total length
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    
    // Combine all parts
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const part of parts) {
      combined.set(part, offset);
      offset += part.length;
    }
    
    return combined;
  }

  /**
   * Finds a member by their member ID.
   */
  private findMemberById(memberId: string): GroupMember | undefined {
    return this.allMembers.find(m => String(m.id) === memberId);
  }

  /**
   * Checks if a user can perform a specific action based on their role.
   */
  canPerformAction(userId: string, action: string): boolean {
    const member = this.memberMap.get(userId);
    if (!member) {
      return false;
    }

    // Define role-based permissions
    const adminActions = new Set([
      "addMember",
      "removeMember", 
      "changeRole",
      "rotateEpoch",
      "deleteGroup",
      "updateGroup",
    ]);

    const memberActions = new Set([
      "read",
      "write",
      "sync",
      "createInvite",
    ]);

    if (member.role === "admin") {
      // Admins can do everything
      return true;
    }

    // Regular members can only do member actions
    return memberActions.has(action);
  }

  /**
   * Gets the role of a specific user in the group.
   */
  getMemberRole(userId: string): GroupRole | null {
    const member = this.memberMap.get(userId);
    return member?.role ?? null;
  }

  /**
   * Checks if a user is a member of the group.
   */
  isMember(userId: string): boolean {
    return this.memberMap.has(userId);
  }

  /**
   * Gets all current group members.
   */
  getMembers(): ReadonlyArray<GroupMember> {
    return this.allMembers;
  }
}