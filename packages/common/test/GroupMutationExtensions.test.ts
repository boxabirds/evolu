import { expect, test, describe } from "vitest";
import { 
  groupContextToDataOwner,
  enhanceMutationOptions,
  isGroupDataOwner,
  extractGroupIdFromDataOwner,
  // Legacy exports for backward compatibility
  groupContextToSharedOwner,
  isGroupSharedOwner,
  extractGroupIdFromSharedOwner,
  type GroupMutationOptions
} from "../src/Evolu/GroupMutationExtensions.js";
import type { GroupContext } from "../src/Evolu/GroupAPI.js";
import type { GroupId } from "../src/Evolu/GroupSchema.js";
import type { DataOwner } from "../src/Evolu/MultiOwnerAPI.js";

describe("GroupMutationExtensions", () => {
  test("converts group context to data owner", () => {
    const context: GroupContext = {
      groupId: "group-123" as GroupId,
      role: "admin",
    };
    
    const dataOwner = groupContextToDataOwner(context);
    
    expect(dataOwner.type).toBe("group");
    expect(dataOwner.id).toBe("group-123");
  });

  test("enhances mutation options with group context", () => {
    const context: GroupContext = {
      groupId: "group-456" as GroupId,
      role: "member",
    };
    
    const options: GroupMutationOptions = {
      onComplete: () => {},
      groupContext: context,
    };
    
    const enhanced = enhanceMutationOptions(options);
    
    expect(enhanced).toBeDefined();
    expect(enhanced!.owner).toBeDefined();
    expect((enhanced!.owner as DataOwner).type).toBe("group");
    expect((enhanced!.owner as DataOwner).id).toBe("group-456");
    expect(enhanced!.onComplete).toBe(options.onComplete);
  });

  test("preserves existing owner in mutation options", () => {
    const existingOwner: DataOwner = {
      type: "group",
      id: "existing-owner" as any,
    };
    
    const context: GroupContext = {
      groupId: "group-789" as GroupId,
      role: "admin",
    };
    
    const options: GroupMutationOptions = {
      owner: existingOwner,
      groupContext: context,
    };
    
    const enhanced = enhanceMutationOptions(options);
    
    expect(enhanced).toBeDefined();
    expect(enhanced!.owner).toBe(existingOwner);
    expect((enhanced!.owner! as DataOwner).id).toBe("existing-owner");
  });

  test("returns options unchanged when no group context", () => {
    const options = {
      onComplete: () => {},
      onlyValidate: true,
    };
    
    const enhanced = enhanceMutationOptions(options);
    
    expect(enhanced).toBe(options);
  });

  test("handles undefined options", () => {
    const enhanced = enhanceMutationOptions(undefined);
    
    expect(enhanced).toBeUndefined();
  });

  test("identifies group data owners", () => {
    const groupOwner: DataOwner = {
      type: "group",
      id: "test-group" as any,
    };
    
    const appOwner: DataOwner = {
      type: "app",
      id: "app-owner" as any,
    };
    
    expect(isGroupDataOwner(groupOwner)).toBe(true);
    expect(isGroupDataOwner(appOwner)).toBe(false);
  });

  test("extracts group ID from data owner", () => {
    const groupOwner: DataOwner = {
      type: "group",
      id: "my-group-123" as any,
    };
    
    const appOwner: DataOwner = {
      type: "app",
      id: "app-owner" as any,
    };
    
    expect(extractGroupIdFromDataOwner(groupOwner)).toBe("my-group-123");
    expect(extractGroupIdFromDataOwner(appOwner)).toBe(null);
  });

  // Legacy compatibility tests (these will be removed once all Group code is updated)
  describe("Legacy SharedOwner compatibility", () => {
    test("converts group context to shared owner (legacy)", () => {
      const context: GroupContext = {
        groupId: "group-123" as GroupId,
        role: "admin",
      };
      
      const result = groupContextToSharedOwner(context);
      
      // The legacy function returns a LegacySharedOwner for true backward compatibility
      expect((result as any).type).toBe("shared");
      expect((result as any).id).toBe("group:group-123");
    });

    test("identifies group shared owners (legacy)", () => {
      // Legacy function always returns false during transition
      expect(isGroupSharedOwner({} as any)).toBe(false);
    });

    test("extracts group ID from shared owner (legacy)", () => {
      // Legacy function always returns null during transition  
      expect(extractGroupIdFromSharedOwner({} as any)).toBe(null);
    });
  });
});