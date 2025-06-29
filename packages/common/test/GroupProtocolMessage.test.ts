import { expect, test, describe } from "vitest";
import { 
  isGroupProtocolMessage,
  createGroupProtocolMessage,
  validateGroupProtocolMessage,
  extractGroupContext,
  filterMessagesByGroup,
  type GroupProtocolMessage,
  type GroupOperationMetadata,
  type GroupOperationType,
} from "../src/Evolu/GroupProtocolMessage.js";
import type { 
  ProtocolMessage, 
  Base64Url256,
  BinaryOwnerId,
  EncryptedCrdtMessage,
} from "../src/Evolu/Protocol.js";
import type { GroupId } from "../src/Evolu/GroupTypes.js";
import { NonEmptyString, NonNegativeInt } from "../src/Type.js";
import { protocolVersion } from "../src/Evolu/Protocol.js";

describe("GroupProtocolMessage", () => {
  const createTestProtocolMessage = (): ProtocolMessage => {
    return {
      protocolVersion,
      ownerId: "owner123" as unknown as BinaryOwnerId,
      messages: [],
      ranges: [],
    } as ProtocolMessage;
  };
  
  const createTestGroupOperation = (
    operation: GroupOperationType = "group_create"
  ): GroupOperationMetadata => {
    return {
      operation,
      groupId: "group-123" as GroupId,
      epochNumber: 1 as typeof NonNegativeInt.Type,
      actorId: "user-123" as typeof NonEmptyString.Type,
    };
  };

  test("isGroupProtocolMessage identifies group messages", () => {
    const regularMessage = createTestProtocolMessage();
    expect(isGroupProtocolMessage(regularMessage)).toBe(false);
    
    const groupMessage: GroupProtocolMessage = {
      ...regularMessage,
      groupId: "group-123" as GroupId,
    };
    expect(isGroupProtocolMessage(groupMessage)).toBe(true);
  });
  
  test("createGroupProtocolMessage creates valid group message", () => {
    const baseMessage = createTestProtocolMessage();
    const groupId = "group-123" as GroupId;
    const epochNumber = 1 as typeof NonNegativeInt.Type;
    const groupOperation = createTestGroupOperation();
    const groupMetadata = "metadata-123" as Base64Url256;
    
    const groupMessage = createGroupProtocolMessage(
      baseMessage,
      groupId,
      epochNumber,
      groupOperation,
      groupMetadata
    );
    
    expect(groupMessage.protocolVersion).toBe(baseMessage.protocolVersion);
    expect(groupMessage.ownerId).toBe(baseMessage.ownerId);
    expect(groupMessage.groupId).toBe(groupId);
    expect(groupMessage.epochNumber).toBe(epochNumber);
    expect(groupMessage.groupOperation).toEqual(groupOperation);
    expect(groupMessage.groupMetadata).toBe(groupMetadata);
  });
  
  test("createGroupProtocolMessage works without optional fields", () => {
    const baseMessage = createTestProtocolMessage();
    const groupId = "group-456" as GroupId;
    const epochNumber = 2 as typeof NonNegativeInt.Type;
    
    const groupMessage = createGroupProtocolMessage(
      baseMessage,
      groupId,
      epochNumber
    );
    
    expect(groupMessage.groupId).toBe(groupId);
    expect(groupMessage.epochNumber).toBe(epochNumber);
    expect(groupMessage.groupOperation).toBeUndefined();
    expect(groupMessage.groupMetadata).toBeUndefined();
  });
  
  test("validateGroupProtocolMessage validates message structure", () => {
    // Valid base protocol message
    const validMessage = createTestProtocolMessage();
    expect(validateGroupProtocolMessage(validMessage)).toBe(true);
    
    // Valid group protocol message
    const validGroupMessage: GroupProtocolMessage = {
      ...validMessage,
      groupId: "group-123" as GroupId,
      epochNumber: 1 as typeof NonNegativeInt.Type,
      groupOperation: createTestGroupOperation(),
    };
    expect(validateGroupProtocolMessage(validGroupMessage)).toBe(true);
    
    // Invalid messages
    expect(validateGroupProtocolMessage(null)).toBe(false);
    expect(validateGroupProtocolMessage({})).toBe(false);
    expect(validateGroupProtocolMessage({ protocolVersion: 1 })).toBe(false);
    
    // Invalid group fields
    const invalidGroupMessage = {
      ...validMessage,
      groupId: 123, // Should be string
    };
    expect(validateGroupProtocolMessage(invalidGroupMessage)).toBe(false);
  });
  
  test("extractGroupContext extracts group information", () => {
    const regularMessage = createTestProtocolMessage();
    expect(extractGroupContext(regularMessage)).toBeNull();
    
    const groupMessage: GroupProtocolMessage = {
      ...regularMessage,
      groupId: "group-123" as GroupId,
      epochNumber: 5 as typeof NonNegativeInt.Type,
      groupOperation: createTestGroupOperation("member_add"),
    };
    
    const context = extractGroupContext(groupMessage);
    expect(context).not.toBeNull();
    expect(context?.groupId).toBe("group-123");
    expect(context?.epochNumber).toBe(5);
    expect(context?.operation).toBe("member_add");
  });
  
  test("filterMessagesByGroup returns messages (Phase 1 stub)", () => {
    const messages: EncryptedCrdtMessage[] = [
      { data: "msg1" } as any,
      { data: "msg2" } as any,
    ];
    
    const filtered = filterMessagesByGroup(messages, "group-123" as GroupId);
    expect(filtered).toEqual(messages); // Phase 1: returns all messages
  });
  
  describe("Group Operations", () => {
    test("supports all group operation types", () => {
      const operationTypes: GroupOperationType[] = [
        "group_create",
        "member_add",
        "member_remove",
        "member_update_role",
        "epoch_rotate",
        "invite_create",
        "invite_use",
        "invite_revoke",
        "group_update",
        "group_sync",
      ];
      
      for (const opType of operationTypes) {
        const operation = createTestGroupOperation(opType);
        expect(operation.operation).toBe(opType);
      }
    });
    
    test("group operation metadata includes target for member operations", () => {
      const operation: GroupOperationMetadata = {
        ...createTestGroupOperation("member_remove"),
        targetId: "user-456" as typeof NonEmptyString.Type,
      };
      
      expect(operation.targetId).toBe("user-456");
    });
  });
});