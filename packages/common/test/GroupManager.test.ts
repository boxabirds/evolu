import { expect, test, describe, vi } from "vitest";
import { 
  createGroupManager, 
  type GroupManagerDeps, 
  type GroupError,
  type GroupMetadataUpdate,
} from "../src/Evolu/GroupManager.js";
import { createGroupTables } from "../src/Evolu/GroupDbInit.js";
import { createGroupActivityLogger } from "../src/Evolu/GroupActivityLogger.js";
import { sql } from "../src/Sqlite.js";
import { testCreateSqliteDriver, testSimpleName, testTime, testNanoIdLib, testRandom } from "./_deps.js";
import { createSqlite } from "../src/Sqlite.js";
import { getOrThrow } from "../src/Result.js";
import type { GroupId, GroupRole } from "../src/Evolu/GroupTypes.js";

describe("GroupManager", () => {
  const createTestDeps = async (currentUserId = "user-123"): Promise<GroupManagerDeps> => {
    const sqliteResult = await createSqlite({
      createSqliteDriver: testCreateSqliteDriver,
    })(testSimpleName);
    const sqlite = getOrThrow(sqliteResult);
    
    // Create group tables
    const tablesResult = createGroupTables({ sqlite });
    getOrThrow(tablesResult);
    
    const activityLogger = createGroupActivityLogger({
      sqlite,
      time: testTime,
      nanoIdLib: testNanoIdLib,
    });

    return {
      sqlite,
      time: testTime,
      nanoIdLib: testNanoIdLib,
      random: testRandom,
      currentUserId,
      activityLogger,
    };
  };

  test("creates a new group", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const result = manager.create("Test Group");
    expect(result.ok).toBe(true);

    if (result.ok) {
      const group = result.value;
      expect(group.name).toBe("Test Group");
      expect(group.createdBy).toBe("user-123");
      expect(group.currentEpoch).toBe(1);
      expect(group.members).toHaveLength(1);
      expect(group.members[0].userId).toBe("user-123");
      expect(group.members[0].role).toBe("admin");
      expect(group.epochManager).toBeDefined();
      expect(group.authProvider).toBeDefined();
      expect(group.securityContext).toBeDefined();
    }
  });

  test("rejects group names that are too long", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const longName = "a".repeat(51);
    const result = manager.create(longName);
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const error = result.error as GroupError;
      expect(error.type).toBe("GroupNameTooLong");
    }
  });

  test("gets a group by ID", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const createResult = manager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      const getResult = manager.get(groupId);
      
      expect(getResult.ok).toBe(true);
      if (getResult.ok && getResult.value) {
        expect(getResult.value.id).toBe(groupId);
        expect(getResult.value.name).toBe("Test Group");
        expect(getResult.value.members).toHaveLength(1);
      }
    }
  });

  test("returns null for non-existent group", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const result = manager.get("non-existent" as GroupId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(null);
    }
  });

  test("lists groups for current user", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    // Create multiple groups
    manager.create("Group 1");
    manager.create("Group 2");
    manager.create("Group 3");

    const listResult = manager.list();
    expect(listResult.ok).toBe(true);
    if (listResult.ok) {
      expect(listResult.value).toHaveLength(3);
      expect(listResult.value.map(g => g.name)).toContain("Group 1");
      expect(listResult.value.map(g => g.name)).toContain("Group 2");
      expect(listResult.value.map(g => g.name)).toContain("Group 3");
    }
  });

  test("adds a member to a group", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const createResult = manager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      const addResult = manager.addMember(
        groupId,
        "user-456",
        "member" as GroupRole,
        "public-key-456"
      );

      expect(addResult.ok).toBe(true);

      // Verify member was added
      const groupResult = manager.get(groupId);
      if (groupResult.ok && groupResult.value) {
        const activeMembers = groupResult.value.members.filter(m => !m.leftAt);
        expect(activeMembers).toHaveLength(2);
        expect(activeMembers.some(m => m.userId === "user-456")).toBe(true);
      }
    }
  });

  test("prevents adding duplicate members", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const createResult = manager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      
      // Add member once
      manager.addMember(groupId, "user-456", "member" as GroupRole, "public-key");
      
      // Try to add again
      const result = manager.addMember(groupId, "user-456", "member" as GroupRole, "public-key");
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as GroupError;
        expect(error.type).toBe("UserAlreadyMember");
      }
    }
  });

  test("requires admin role to add members", async () => {
    // Create shared sqlite instance
    const sqliteResult = await createSqlite({
      createSqliteDriver: testCreateSqliteDriver,
    })(testSimpleName);
    const sqlite = getOrThrow(sqliteResult);
    
    // Create group tables
    const tablesResult = createGroupTables({ sqlite });
    getOrThrow(tablesResult);

    // Create admin deps with shared sqlite
    const adminDeps: GroupManagerDeps = {
      sqlite,
      time: testTime,
      nanoIdLib: testNanoIdLib,
      random: testRandom,
      currentUserId: "admin-user",
    };
    const adminManager = createGroupManager(adminDeps);

    // Admin creates group
    const createResult = adminManager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      
      // Admin adds regular member
      adminManager.addMember(groupId, "member-user", "member" as GroupRole, "public-key");

      // Create manager for the regular member with same sqlite instance
      const memberDeps: GroupManagerDeps = {
        sqlite,
        time: testTime,
        nanoIdLib: testNanoIdLib,
        random: testRandom,
        currentUserId: "member-user",
      };
      const memberManager = createGroupManager(memberDeps);

      // Member tries to add another member
      const result = memberManager.addMember(
        groupId,
        "another-user",
        "member" as GroupRole,
        "public-key"
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as GroupError;
        expect(error.type).toBe("InsufficientPermissions");
      }
    }
  });

  test("removes a member from a group", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const createResult = manager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      
      // Add a member
      manager.addMember(groupId, "user-456", "member" as GroupRole, "public-key");
      
      // Remove the member
      const removeResult = manager.removeMember(groupId, "user-456");
      expect(removeResult.ok).toBe(true);

      // Verify member was removed (marked as left)
      const groupResult = manager.get(groupId);
      if (groupResult.ok && groupResult.value) {
        const activeMembers = groupResult.value.members.filter(m => !m.leftAt);
        expect(activeMembers).toHaveLength(1);
        expect(activeMembers[0].userId).toBe("user-123");
        
        // Check that removed member has leftAt timestamp
        const removedMember = groupResult.value.members.find(m => m.userId === "user-456");
        expect(removedMember?.leftAt).toBeDefined();
      }
    }
  });

  test("prevents removing the last admin", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const createResult = manager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      
      // Try to remove the only admin
      const result = manager.removeMember(groupId, "user-123");
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as GroupError;
        expect(error.type).toBe("CannotRemoveLastAdmin");
      }
    }
  });

  test("allows user to leave a group", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const createResult = manager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      
      // Add another admin so we can leave
      manager.addMember(groupId, "user-456", "admin" as GroupRole, "public-key");
      
      // Leave the group
      const leaveResult = manager.leave(groupId);
      expect(leaveResult.ok).toBe(true);

      // Verify user left
      const listResult = manager.list();
      if (listResult.ok) {
        expect(listResult.value.some(g => g.id === groupId)).toBe(false);
      }
    }
  });

  test("prevents leaving if last admin", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const createResult = manager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      
      // Try to leave as the only admin
      const result = manager.leave(groupId);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as GroupError;
        expect(error.type).toBe("CannotRemoveLastAdmin");
      }
    }
  });

  test("deletes a group", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const createResult = manager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      
      // Delete the group
      const deleteResult = manager.delete(groupId);
      expect(deleteResult.ok).toBe(true);

      // Verify group is gone
      const getResult = manager.get(groupId);
      if (getResult.ok) {
        expect(getResult.value).toBe(null);
      }
    }
  });

  test("prevents deleting non-empty group", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    const createResult = manager.create("Test Group");
    expect(createResult.ok).toBe(true);

    if (createResult.ok) {
      const groupId = createResult.value.id;
      
      // Add another member
      manager.addMember(groupId, "user-456", "member" as GroupRole, "public-key");
      
      // Try to delete
      const result = manager.delete(groupId);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as GroupError;
        expect(error.type).toBe("GroupNotEmpty");
      }
    }
  });

  test("handles transaction rollback on error", async () => {
    const deps = await createTestDeps();
    const manager = createGroupManager(deps);

    // Create a group with a name that will cause an error in the transaction
    // by manually inserting a group with a duplicate ID
    const groupId = testNanoIdLib.nanoid();
    deps.sqlite.exec(sql`
      insert into evolu_group (id, name, currentEpoch, createdAt, createdBy)
      values (${groupId}, 'Existing Group', 1, '2024-01-01T00:00:00Z', 'user-123')
    `);

    // Mock nanoid to return the same ID
    const originalNanoid = deps.nanoIdLib.nanoid;
    let callCount = 0;
    (deps.nanoIdLib as any).nanoid = () => {
      if (callCount++ === 0) return groupId; // First call returns duplicate
      return originalNanoid();
    };

    // Try to create a group - should fail due to duplicate ID
    const result = manager.create("New Group");
    expect(result.ok).toBe(false);

    // Verify no partial data was inserted
    const memberCount = deps.sqlite.exec<{ count: number }>(sql`
      select count(*) as count from evolu_group_member
      where groupId = ${groupId}
    `);
    
    if (memberCount.ok) {
      expect(memberCount.value.rows[0].count).toBe(0);
    }
  });
  
  describe("updateMetadata", () => {
    test("updates group name", async () => {
      const deps = await createTestDeps();
      const manager = createGroupManager(deps);
      
      // Create a group first
      const createResult = manager.create("Original Name");
      expect(createResult.ok).toBe(true);
      
      if (createResult.ok) {
        const groupId = createResult.value.id;
        
        // Update the name
        const updates: GroupMetadataUpdate = {
          name: "Updated Name",
        };
        
        const updateResult = manager.updateMetadata(groupId, updates);
        expect(updateResult.ok).toBe(true);
        
        // Verify the update
        const getResult = manager.get(groupId);
        expect(getResult.ok).toBe(true);
        if (getResult.ok && getResult.value) {
          expect(getResult.value.name).toBe("Updated Name");
        }
      }
    });
    
    test("updates group description and settings", async () => {
      const deps = await createTestDeps();
      const manager = createGroupManager(deps);
      
      const createResult = manager.create("Test Group");
      expect(createResult.ok).toBe(true);
      
      if (createResult.ok) {
        const groupId = createResult.value.id;
        
        const updates: GroupMetadataUpdate = {
          description: "A test group",
          settings: { theme: "dark", notifications: true },
        };
        
        const updateResult = manager.updateMetadata(groupId, updates);
        expect(updateResult.ok).toBe(true);
      }
    });
    
    test("requires admin role", async () => {
      // Create shared sqlite instance
      const sqliteResult = await createSqlite({
        createSqliteDriver: testCreateSqliteDriver,
      })(testSimpleName);
      const sqlite = getOrThrow(sqliteResult);
      
      // Create group tables
      const tablesResult = createGroupTables({ sqlite });
      getOrThrow(tablesResult);

      const activityLogger = createGroupActivityLogger({
        sqlite,
        time: testTime,
        nanoIdLib: testNanoIdLib,
      });

      // Create admin deps with shared sqlite
      const adminDeps: GroupManagerDeps = {
        sqlite,
        time: testTime,
        nanoIdLib: testNanoIdLib,
        random: testRandom,
        currentUserId: "admin-user",
        activityLogger,
      };
      const adminManager = createGroupManager(adminDeps);

      // Create member deps with shared sqlite
      const memberDeps: GroupManagerDeps = {
        sqlite,
        time: testTime,
        nanoIdLib: testNanoIdLib,
        random: testRandom,
        currentUserId: "member-user",
        activityLogger,
      };
      const memberManager = createGroupManager(memberDeps);
      
      // Admin creates group
      const createResult = adminManager.create("Test Group");
      expect(createResult.ok).toBe(true);
      
      if (createResult.ok) {
        const groupId = createResult.value.id;
        
        // Add member
        const addResult = adminManager.addMember(groupId, "member-user", "member", "public-key");
        expect(addResult.ok).toBe(true);
        
        // Member tries to update metadata - should fail
        const updates: GroupMetadataUpdate = { name: "Hacked Name" };
        const updateResult = memberManager.updateMetadata(groupId, updates);
        expect(updateResult.ok).toBe(false);
        if (!updateResult.ok) {
          expect(updateResult.error.type).toBe("InsufficientPermissions");
        }
      }
    });
  });
  
  describe("updateMemberRole", () => {
    test("updates member role from member to admin", async () => {
      const deps = await createTestDeps("admin-user");
      const manager = createGroupManager(deps);
      
      // Create group
      const createResult = manager.create("Test Group");
      expect(createResult.ok).toBe(true);
      
      if (createResult.ok) {
        const groupId = createResult.value.id;
        
        // Add member
        const addResult = manager.addMember(groupId, "member-user", "member", "public-key");
        expect(addResult.ok).toBe(true);
        
        // Update role to admin
        const updateResult = manager.updateMemberRole(groupId, "member-user", "admin");
        expect(updateResult.ok).toBe(true);
        
        // Verify the role change
        const getResult = manager.get(groupId);
        expect(getResult.ok).toBe(true);
        if (getResult.ok && getResult.value) {
          const member = getResult.value.members.find(m => m.userId === "member-user");
          expect(member?.role).toBe("admin");
        }
      }
    });
    
    test("prevents removing last admin", async () => {
      const deps = await createTestDeps("admin-user");
      const manager = createGroupManager(deps);
      
      const createResult = manager.create("Test Group");
      expect(createResult.ok).toBe(true);
      
      if (createResult.ok) {
        const groupId = createResult.value.id;
        
        // Try to demote the only admin
        const updateResult = manager.updateMemberRole(groupId, "admin-user", "member");
        expect(updateResult.ok).toBe(false);
        if (!updateResult.ok) {
          expect(updateResult.error.type).toBe("CannotRemoveLastAdmin");
        }
      }
    });
    
    test("requires admin role to update roles", async () => {
      // Create shared sqlite instance
      const sqliteResult = await createSqlite({
        createSqliteDriver: testCreateSqliteDriver,
      })(testSimpleName);
      const sqlite = getOrThrow(sqliteResult);
      
      // Create group tables
      const tablesResult = createGroupTables({ sqlite });
      getOrThrow(tablesResult);

      const activityLogger = createGroupActivityLogger({
        sqlite,
        time: testTime,
        nanoIdLib: testNanoIdLib,
      });

      // Create admin deps with shared sqlite
      const adminDeps: GroupManagerDeps = {
        sqlite,
        time: testTime,
        nanoIdLib: testNanoIdLib,
        random: testRandom,
        currentUserId: "admin-user",
        activityLogger,
      };
      const adminManager = createGroupManager(adminDeps);

      // Create member deps with shared sqlite
      const memberDeps: GroupManagerDeps = {
        sqlite,
        time: testTime,
        nanoIdLib: testNanoIdLib,
        random: testRandom,
        currentUserId: "member-user",
        activityLogger,
      };
      const memberManager = createGroupManager(memberDeps);
      
      const createResult = adminManager.create("Test Group");
      expect(createResult.ok).toBe(true);
      
      if (createResult.ok) {
        const groupId = createResult.value.id;
        
        // Add member
        const addResult = adminManager.addMember(groupId, "member-user", "member", "public-key");
        expect(addResult.ok).toBe(true);
        
        // Add another member
        const addResult2 = adminManager.addMember(groupId, "other-user", "member", "public-key-2");
        expect(addResult2.ok).toBe(true);
        
        // Member tries to update another member's role - should fail
        const updateResult = memberManager.updateMemberRole(groupId, "other-user", "admin");
        expect(updateResult.ok).toBe(false);
        if (!updateResult.ok) {
          expect(updateResult.error.type).toBe("InsufficientPermissions");
        }
      }
    });
  });
  
  describe("getActivityLog", () => {
    test("retrieves activity log for group", async () => {
      const deps = await createTestDeps();
      const manager = createGroupManager(deps);
      
      // Create group (this logs activity)
      const createResult = manager.create("Test Group");
      expect(createResult.ok).toBe(true);
      
      if (createResult.ok) {
        const groupId = createResult.value.id;
        
        // Add member (this logs activity)
        const addResult = manager.addMember(groupId, "new-user", "member", "public-key");
        expect(addResult.ok).toBe(true);
        
        // Get activity log
        const logResult = manager.getActivityLog(groupId);
        expect(logResult.ok).toBe(true);
        
        if (logResult.ok) {
          // Should have at least group creation and member addition activities
          expect(logResult.value.length).toBeGreaterThanOrEqual(1);
          
          // Check that activities are properly formatted
          const activities = logResult.value;
          for (const activity of activities) {
            expect(activity.id).toBeDefined();
            expect(activity.groupId).toBe(groupId);
            expect(activity.actorId).toBeDefined();
            expect(activity.action).toBeDefined();
            expect(activity.epochNumber).toBeDefined();
            expect(activity.timestamp).toBeDefined();
          }
        }
      }
    });
    
    test("uses pagination parameters", async () => {
      const deps = await createTestDeps();
      const manager = createGroupManager(deps);
      
      const createResult = manager.create("Test Group");
      expect(createResult.ok).toBe(true);
      
      if (createResult.ok) {
        const groupId = createResult.value.id;
        
        // Get with custom limit and offset
        const logResult = manager.getActivityLog(groupId, 5, 0);
        expect(logResult.ok).toBe(true);
      }
    });
  });
  
  describe("activity logging integration", () => {
    test("logs group creation", async () => {
      const deps = await createTestDeps();
      const manager = createGroupManager(deps);
      
      const createResult = manager.create("Test Group");
      expect(createResult.ok).toBe(true);
      
      if (createResult.ok) {
        const groupId = createResult.value.id;
        const logResult = manager.getActivityLog(groupId);
        
        expect(logResult.ok).toBe(true);
        if (logResult.ok) {
          const createActivity = logResult.value.find(a => a.action === "group_created");
          expect(createActivity).toBeDefined();
          expect(createActivity?.actorId).toBe("user-123");
        }
      }
    });
    
    test("logs member operations", async () => {
      const deps = await createTestDeps();
      const manager = createGroupManager(deps);
      
      const createResult = manager.create("Test Group");
      expect(createResult.ok).toBe(true);
      
      if (createResult.ok) {
        const groupId = createResult.value.id;
        
        // Add member
        manager.addMember(groupId, "new-user", "member", "public-key");
        
        // Remove member
        manager.removeMember(groupId, "new-user");
        
        const logResult = manager.getActivityLog(groupId);
        expect(logResult.ok).toBe(true);
        
        if (logResult.ok) {
          const addActivity = logResult.value.find(a => a.action === "member_added");
          const removeActivity = logResult.value.find(a => a.action === "member_removed");
          
          expect(addActivity).toBeDefined();
          expect(removeActivity).toBeDefined();
          expect(addActivity?.targetId).toBe("new-user");
          expect(removeActivity?.targetId).toBe("new-user");
        }
      }
    });
  });
});