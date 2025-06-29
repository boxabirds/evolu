import { expect, test, describe } from "vitest";
import { 
  groupContextToSharedOwner,
  enhanceMutationOptions,
  isGroupSharedOwner,
  extractGroupIdFromSharedOwner,
  type GroupMutationOptions
} from "../src/Evolu/GroupMutationExtensions.js";
import type { GroupContext } from "../src/Evolu/GroupAPI.js";
import type { GroupId } from "../src/Evolu/GroupSchema.js";
import type { SharedOwner } from "../src/Evolu/Owner.js";

describe("GroupMutationExtensions", () => {
  test("converts group context to shared owner", () => {
    const context: GroupContext = {
      groupId: "group-123" as GroupId,
      role: "admin",
    };
    
    const sharedOwner = groupContextToSharedOwner(context);
    
    expect(sharedOwner.id).toBe("group:group-123");
    expect(sharedOwner.encryptionKey).toBeInstanceOf(Uint8Array);
    expect(sharedOwner.encryptionKey.length).toBe(32);
    expect(sharedOwner.writeKey).toBeInstanceOf(Uint8Array);
    expect(sharedOwner.writeKey.length).toBe(16);
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
    expect(enhanced!.owner!.id).toBe("group:group-456");
    expect(enhanced!.onComplete).toBe(options.onComplete);
  });

  test("preserves existing owner in mutation options", () => {
    const existingOwner: SharedOwner = {
      id: "existing-owner" as SharedOwner["id"],
      encryptionKey: new Uint8Array(32),
      writeKey: new Uint8Array(16),
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
    expect(enhanced!.owner!.id).toBe("existing-owner");
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

  test("identifies group shared owners", () => {
    const groupOwner: SharedOwner = {
      id: "group:test-group" as SharedOwner["id"],
      encryptionKey: new Uint8Array(32),
      writeKey: new Uint8Array(16),
    };
    
    const regularOwner: SharedOwner = {
      id: "regular-owner" as SharedOwner["id"],
      encryptionKey: new Uint8Array(32),
      writeKey: new Uint8Array(16),
    };
    
    expect(isGroupSharedOwner(groupOwner)).toBe(true);
    expect(isGroupSharedOwner(regularOwner)).toBe(false);
  });

  test("extracts group ID from shared owner", () => {
    const groupOwner: SharedOwner = {
      id: "group:my-group-123" as SharedOwner["id"],
      encryptionKey: new Uint8Array(32),
      writeKey: new Uint8Array(16),
    };
    
    const regularOwner: SharedOwner = {
      id: "regular-owner" as SharedOwner["id"],
      encryptionKey: new Uint8Array(32),
      writeKey: new Uint8Array(16),
    };
    
    expect(extractGroupIdFromSharedOwner(groupOwner)).toBe("my-group-123");
    expect(extractGroupIdFromSharedOwner(regularOwner)).toBe(null);
  });
});