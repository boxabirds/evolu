import { expect, test, describe } from "vitest";
import { 
  isGroupProtocolMessage,
  createGroupProtocolMessage,
  type GroupProtocolMessage
} from "../src/Evolu/GroupProtocolMessage.js";
import type { ProtocolMessage, Base64Url256 } from "../src/Evolu/Protocol.js";
import type { GroupId, EpochNumber } from "../src/Evolu/GroupSchema.js";
import { getOrThrow } from "../src/Result.js";
import { NonEmptyString50, NonNegativeInt } from "../src/Type.js";

describe("GroupProtocolMessage", () => {
  const createTestProtocolMessage = (): ProtocolMessage => {
    return {
      type: "sync",
      data: "test-data" as Base64Url256,
    } as ProtocolMessage;
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
    const epochNumber = 1 as EpochNumber;
    const groupMetadata = "metadata-123" as Base64Url256;
    
    const groupMessage = createGroupProtocolMessage(
      baseMessage,
      groupId,
      epochNumber,
      groupMetadata
    );
    
    expect(groupMessage.type).toBe(baseMessage.type);
    expect(groupMessage.data).toBe(baseMessage.data);
    expect(groupMessage.groupId).toBe(groupId);
    expect(groupMessage.epochNumber).toBe(epochNumber);
    expect(groupMessage.groupMetadata).toBe(groupMetadata);
  });
  
  test("createGroupProtocolMessage works without metadata", () => {
    const baseMessage = createTestProtocolMessage();
    const groupId = "group-456" as GroupId;
    const epochNumber = 2 as EpochNumber;
    
    const groupMessage = createGroupProtocolMessage(
      baseMessage,
      groupId,
      epochNumber
    );
    
    expect(groupMessage.groupId).toBe(groupId);
    expect(groupMessage.epochNumber).toBe(epochNumber);
    expect(groupMessage.groupMetadata).toBeUndefined();
  });
});