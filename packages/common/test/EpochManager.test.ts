import { expect, test, describe } from "vitest";
import { createEpochManager } from "../src/Evolu/EpochManager.js";

describe("EpochManager", () => {
  test("initializes with epoch 1 by default", () => {
    const manager = createEpochManager("group123");
    
    expect(manager.currentEpoch).toBe(1);
    expect(manager.groupId).toBe("group123");
  });
  
  test("initializes with custom epoch", () => {
    const manager = createEpochManager("group123", 5);
    
    expect(manager.currentEpoch).toBe(5);
  });
  
  test("gets current epoch", () => {
    const manager = createEpochManager("group123");
    const epoch = manager.getCurrentEpoch();
    
    expect(epoch.id).toBe(1);
    expect(epoch.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(epoch.endedAt).toBeUndefined();
  });
  
  test("increments epoch", () => {
    const manager = createEpochManager("group123");
    
    const newEpoch = manager.incrementEpoch();
    
    expect(manager.currentEpoch).toBe(2);
    expect(newEpoch.id).toBe(2);
    expect(newEpoch.startedAt).toBeDefined();
    expect(newEpoch.endedAt).toBeUndefined();
    
    // Check that previous epoch was ended
    const history = manager.getEpochHistory();
    expect(history.length).toBe(2);
    expect(history[0].endedAt).toBeDefined();
    expect(history[1].endedAt).toBeUndefined();
  });
  
  test("tracks epoch history", () => {
    const manager = createEpochManager("group123");
    
    // Start with epoch 1
    expect(manager.getEpochHistory().length).toBe(1);
    
    // Increment to epoch 2
    manager.incrementEpoch();
    expect(manager.getEpochHistory().length).toBe(2);
    
    // Increment to epoch 3
    manager.incrementEpoch();
    const history = manager.getEpochHistory();
    expect(history.length).toBe(3);
    
    // Verify epochs are in order
    expect(history[0].id).toBe(1);
    expect(history[1].id).toBe(2);
    expect(history[2].id).toBe(3);
    
    // Verify only current epoch is not ended
    expect(history[0].endedAt).toBeDefined();
    expect(history[1].endedAt).toBeDefined();
    expect(history[2].endedAt).toBeUndefined();
  });
  
  test("handles multiple increments correctly", () => {
    const manager = createEpochManager("group123");
    
    for (let i = 0; i < 5; i++) {
      manager.incrementEpoch();
    }
    
    expect(manager.currentEpoch).toBe(6);
    expect(manager.getEpochHistory().length).toBe(6);
  });
});