import { expect, test, describe, beforeEach } from "vitest";
import { 
  createGroupInviteManager, 
  clearInviteStore,
  type GroupInviteDeps,
  type InviteError 
} from "../src/Evolu/GroupInvite.js";
import { createGroupManager, type GroupManagerDeps } from "../src/Evolu/GroupManager.js";
import { createGroupTables } from "../src/Evolu/GroupDbInit.js";
import { testCreateSqliteDriver, testSimpleName, testTime, testNanoIdLib, testRandom } from "./_deps.js";
import { createSqlite } from "../src/Sqlite.js";
import { getOrThrow } from "../src/Result.js";
import type { GroupRole } from "../src/Evolu/GroupSchema.js";

describe("GroupInvite", () => {
  beforeEach(() => {
    // Clear invite store before each test
    clearInviteStore();
  });

  const createTestDeps = async (currentUserId = "user-123"): Promise<GroupInviteDeps> => {
    const sqliteResult = await createSqlite({
      createSqliteDriver: testCreateSqliteDriver,
    })(testSimpleName);
    const sqlite = getOrThrow(sqliteResult);
    
    // Create group tables
    const tablesResult = createGroupTables({ sqlite });
    getOrThrow(tablesResult);

    const groupManagerDeps: GroupManagerDeps = {
      sqlite,
      time: testTime,
      nanoIdLib: testNanoIdLib,
      random: testRandom,
      currentUserId,
    };

    const groupManager = createGroupManager(groupManagerDeps);
    
    const deps: GroupInviteDeps = {
      time: testTime,
      random: testRandom,
      nanoIdLib: testNanoIdLib,
      groupManager,
      currentUserId,
    };
    
    return deps;
  };

  test("generates invite for a group", async () => {
    const deps = await createTestDeps();
    const inviteManager = createGroupInviteManager(deps);

    // Create a group first
    const createResult = deps.groupManager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      
      // Generate invite
      const inviteResult = inviteManager.generateInvite(
        groupId,
        "member" as GroupRole,
        48, // 48 hours
        10  // max 10 uses
      );

      expect(inviteResult.ok).toBe(true);
      if (inviteResult.ok) {
        const invite = inviteResult.value;
        expect(invite.groupId).toBe(groupId);
        expect(invite.role).toBe("member");
        expect(invite.createdBy).toBe("user-123");
        expect(invite.maxUses).toBe(10);
        expect(invite.inviteCode).toBeTruthy();
        expect(invite.inviteCode.length).toBeGreaterThan(10); // Base64 encoded
      }
    }
  });

  test("requires admin role to generate invites", async () => {
    const deps = await createTestDeps("admin-user");
    const inviteManager = createGroupInviteManager(deps);

    // Create group as admin
    const createResult = deps.groupManager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      
      // Add a regular member
      deps.groupManager.addMember(groupId, "member-user", "member" as GroupRole, "public-key");

      // Create invite manager for the member using same group manager
      const memberDeps: GroupInviteDeps = {
        time: testTime,
        random: testRandom,
        nanoIdLib: testNanoIdLib,
        groupManager: deps.groupManager,
        currentUserId: "member-user",
      };
      const memberInviteManager = createGroupInviteManager(memberDeps);

      // Member tries to generate invite
      const inviteResult = memberInviteManager.generateInvite(
        groupId,
        "member" as GroupRole
      );

      expect(inviteResult.ok).toBe(false);
      if (!inviteResult.ok) {
        const error = inviteResult.error as InviteError;
        expect(error.type).toBe("InsufficientPermissions");
      }
    }
  });

  test("validates invite codes", async () => {
    const deps = await createTestDeps();
    const inviteManager = createGroupInviteManager(deps);

    // Create a group and generate invite
    const createResult = deps.groupManager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      const inviteResult = inviteManager.generateInvite(groupId, "member" as GroupRole);
      expect(inviteResult.ok).toBe(true);

      if (inviteResult.ok) {
        const invite = inviteResult.value;
        
        // Validate the invite
        const validation = inviteManager.validateInvite(invite.inviteCode);
        expect(validation.valid).toBe(true);
        expect(validation.groupId).toBe(groupId);
        expect(validation.role).toBe("member");
      }
    }
  });

  test("rejects invalid invite codes", async () => {
    const deps = await createTestDeps();
    const inviteManager = createGroupInviteManager(deps);

    const validation = inviteManager.validateInvite("invalid-code");
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe("InvalidInviteFormat");
  });

  test("rejects expired invites", async () => {
    const deps = await createTestDeps();
    const inviteManager = createGroupInviteManager(deps);

    // Create a group and generate invite with 0 hours expiry
    const createResult = deps.groupManager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      
      // Generate invite that expires immediately
      const inviteResult = inviteManager.generateInvite(groupId, "member" as GroupRole, -1);
      expect(inviteResult.ok).toBe(true);

      if (inviteResult.ok) {
        const invite = inviteResult.value;
        
        // Validate should fail due to expiry
        const validation = inviteManager.validateInvite(invite.inviteCode);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toBe("InviteExpired");
      }
    }
  });

  test("accepts valid invite", async () => {
    const deps = await createTestDeps();
    const inviteManager = createGroupInviteManager(deps);

    // Create a group and generate invite
    const createResult = deps.groupManager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      const inviteResult = inviteManager.generateInvite(groupId, "member" as GroupRole);
      expect(inviteResult.ok).toBe(true);

      if (inviteResult.ok) {
        const invite = inviteResult.value;
        
        // Accept the invite
        const acceptResult = inviteManager.acceptInvite(
          invite.inviteCode,
          "new-user",
          "new-user-public-key"
        );
        
        expect(acceptResult.ok).toBe(true);

        // Verify user was added to group
        const groupResult = deps.groupManager.get(groupId);
        if (groupResult.ok && groupResult.value) {
          const newMember = groupResult.value.members.find(m => m.userId === "new-user");
          expect(newMember).toBeDefined();
          expect(newMember?.role).toBe("member");
          expect(newMember?.publicKey).toBe("new-user-public-key");
        }
      }
    }
  });

  test("respects max uses limit", async () => {
    const deps = await createTestDeps();
    const inviteManager = createGroupInviteManager(deps);

    // Create a group and generate invite with max 1 use
    const createResult = deps.groupManager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      const inviteResult = inviteManager.generateInvite(
        groupId, 
        "member" as GroupRole,
        24, // 24 hours
        1   // max 1 use
      );
      expect(inviteResult.ok).toBe(true);

      if (inviteResult.ok) {
        const invite = inviteResult.value;
        
        // First use should succeed
        const firstAccept = inviteManager.acceptInvite(
          invite.inviteCode,
          "user-1",
          "public-key-1"
        );
        expect(firstAccept.ok).toBe(true);

        // Second use should fail
        const secondAccept = inviteManager.acceptInvite(
          invite.inviteCode,
          "user-2",
          "public-key-2"
        );
        expect(secondAccept.ok).toBe(false);
        if (!secondAccept.ok) {
          const error = secondAccept.error as InviteError;
          expect(error.type).toBe("InviteAlreadyUsed");
        }

        // Validation should also show it's used up
        const validation = inviteManager.validateInvite(invite.inviteCode);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toBe("InviteAlreadyUsed");
      }
    }
  });

  test("prevents duplicate users from joining", async () => {
    const deps = await createTestDeps();
    const inviteManager = createGroupInviteManager(deps);

    // Create a group and generate invite
    const createResult = deps.groupManager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      const inviteResult = inviteManager.generateInvite(groupId, "member" as GroupRole);
      expect(inviteResult.ok).toBe(true);

      if (inviteResult.ok) {
        const invite = inviteResult.value;
        
        // Accept the invite
        const firstAccept = inviteManager.acceptInvite(
          invite.inviteCode,
          "new-user",
          "public-key"
        );
        expect(firstAccept.ok).toBe(true);

        // Try to accept again with same user (different invite code wouldn't matter in real scenario)
        const secondAccept = inviteManager.acceptInvite(
          invite.inviteCode,
          "new-user",
          "public-key"
        );
        expect(secondAccept.ok).toBe(false);
      }
    }
  });
});