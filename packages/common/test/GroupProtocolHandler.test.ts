import { expect, test, describe } from "vitest";
import { 
  routeMessageToPartition,
  type GroupStorage
} from "../src/Evolu/GroupProtocolHandler.js";
import type { ProtocolMessage } from "../src/Evolu/Protocol.js";
import type { GroupProtocolMessage } from "../src/Evolu/GroupProtocolMessage.js";
import type { GroupId, EpochNumber } from "../src/Evolu/GroupSchema.js";
import { getOrThrow } from "../src/Result.js";
import { NonEmptyString50, NonNegativeInt } from "../src/Type.js";

describe("GroupProtocolHandler", () => {
  const createMockGroupStorage = (): GroupStorage => {
    return {
      // Base Storage methods
      getSize: () => null,
      fingerprint: () => null,
      fingerprintRanges: () => null,
      findLowerBound: () => null,
      iterate: () => {},
      validateWriteKey: () => false,
      setWriteKey: () => false,
      writeMessages: () => false,
      readDbChange: () => null,
      deleteOwner: () => false,
      // Group-specific methods
      getGroupId: () => null,
      validateGroupAccess: () => false,
      getGroupEpoch: () => 0,
    };
  };

  test("routeMessageToPartition routes regular messages to default", () => {
    const storage = createMockGroupStorage();
    const message = new Uint8Array([1, 2, 3]) as ProtocolMessage;
    
    const partition = routeMessageToPartition(message, storage);
    expect(partition).toBe("default");
  });
  
  test("routeMessageToPartition routes group messages to group partition", () => {
    const storage = createMockGroupStorage();
    const groupId = "group-123" as GroupId;
    const epochNumber = 5 as EpochNumber;
    
    const groupMessage: GroupProtocolMessage = {
      groupId,
      epochNumber,
    } as GroupProtocolMessage;
    
    const partition = routeMessageToPartition(groupMessage, storage);
    expect(partition).toBe("group:group-123:5");
  });
});