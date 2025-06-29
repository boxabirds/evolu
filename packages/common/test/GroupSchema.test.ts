import { expect, test, describe } from "vitest";
import { groupTables, isGroupTable, getGroupTableNames } from "../src/Evolu/GroupSchema.js";
import { InferType } from "../src/Type.js";

describe("GroupSchema", () => {
  test("defines all required group tables", () => {
    expect(groupTables).toHaveProperty("evolu_group");
    expect(groupTables).toHaveProperty("evolu_group_member");
    expect(groupTables).toHaveProperty("evolu_epoch");
    expect(groupTables).toHaveProperty("evolu_epoch_key");
  });
  
  test("group table has required fields", () => {
    const groupTable = groupTables.evolu_group;
    expect(groupTable).toHaveProperty("id");
    expect(groupTable).toHaveProperty("name");
    expect(groupTable).toHaveProperty("currentEpoch");
    expect(groupTable).toHaveProperty("createdAt");
    expect(groupTable).toHaveProperty("createdBy");
    expect(groupTable).toHaveProperty("metadata");
  });
  
  test("group member table has required fields", () => {
    const memberTable = groupTables.evolu_group_member;
    expect(memberTable).toHaveProperty("id");
    expect(memberTable).toHaveProperty("groupId");
    expect(memberTable).toHaveProperty("userId");
    expect(memberTable).toHaveProperty("role");
    expect(memberTable).toHaveProperty("publicKey");
    expect(memberTable).toHaveProperty("joinedAt");
    expect(memberTable).toHaveProperty("leftAt");
  });
  
  test("epoch table has required fields", () => {
    const epochTable = groupTables.evolu_epoch;
    expect(epochTable).toHaveProperty("id");
    expect(epochTable).toHaveProperty("groupId");
    expect(epochTable).toHaveProperty("epochNumber");
    expect(epochTable).toHaveProperty("startedAt");
    expect(epochTable).toHaveProperty("endedAt");
    expect(epochTable).toHaveProperty("keyHash");
  });
  
  test("epoch key table has required fields", () => {
    const epochKeyTable = groupTables.evolu_epoch_key;
    expect(epochKeyTable).toHaveProperty("id");
    expect(epochKeyTable).toHaveProperty("groupId");
    expect(epochKeyTable).toHaveProperty("epochNumber");
    expect(epochKeyTable).toHaveProperty("memberId");
    expect(epochKeyTable).toHaveProperty("encryptedKey");
    expect(epochKeyTable).toHaveProperty("createdAt");
  });
  
  test("isGroupTable identifies group tables correctly", () => {
    expect(isGroupTable("evolu_group")).toBe(true);
    expect(isGroupTable("evolu_group_member")).toBe(true);
    expect(isGroupTable("evolu_epoch")).toBe(true);
    expect(isGroupTable("evolu_epoch_key")).toBe(true);
    expect(isGroupTable("some_other_table")).toBe(false);
  });
  
  test("getGroupTableNames returns all group table names", () => {
    const names = getGroupTableNames();
    expect(names).toContain("evolu_group");
    expect(names).toContain("evolu_group_member");
    expect(names).toContain("evolu_epoch");
    expect(names).toContain("evolu_epoch_key");
    expect(names).toHaveLength(4);
  });
});