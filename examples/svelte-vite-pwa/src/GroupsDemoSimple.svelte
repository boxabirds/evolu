<script lang="ts">
  import { type GroupId, type GroupContext } from '@evolu/common';
  
  export let evolu: any;
  
  // Check if groups are supported by checking if methods exist
  const supportsGroups = !!(evolu.createGroup && evolu.joinGroup && evolu.listGroups);
  
  // Local state
  let groups: any[] = [];
  let currentGroup: GroupContext | null = null;
  let newGroupName = '';
  let inviteCode = '';
  let selectedGroupId: GroupId | null = null;
  let createError: string | null = null;
  let joinError: string | null = null;
  let loading = false;
  
  // Load groups and subscribe to changes
  $: if (supportsGroups) {
    loadGroups();
    
    // Subscribe to current group changes
    const unsubscribe = evolu.subscribeCurrentGroup(() => {
      currentGroup = evolu.getCurrentGroup();
    });
    
    // Cleanup would go here but Svelte doesn't have a direct equivalent
  }
  
  async function loadGroups() {
    loading = true;
    try {
      const result = await evolu.listGroups();
      if (result.ok) {
        groups = result.value;
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      loading = false;
    }
  }
  
  async function handleCreateGroup() {
    if (!newGroupName.trim() || !supportsGroups) return;
    
    createError = null;
    try {
      const result = await evolu.createGroup(newGroupName);
      if (result.ok) {
        console.log('Group created:', result.value);
        newGroupName = '';
        selectedGroupId = result.value.id;
        await loadGroups();
      } else {
        createError = `Failed to create group: ${result.error.type}`;
        console.error('Create group error:', result.error);
      }
    } catch (error) {
      createError = `Unexpected error: ${error}`;
      console.error('Unexpected error:', error);
    }
  }
  
  async function handleJoinGroup() {
    if (!inviteCode.trim() || !supportsGroups) return;
    
    joinError = null;
    try {
      const result = await evolu.joinGroup(inviteCode);
      if (result.ok) {
        console.log('Joined group successfully');
        inviteCode = '';
        await loadGroups();
      } else {
        joinError = `Failed to join group: ${result.error.type}`;
        console.error('Join group error:', result.error);
      }
    } catch (error) {
      joinError = `Unexpected error: ${error}`;
      console.error('Unexpected error:', error);
    }
  }
  
  function handleSetCurrentGroup(groupId: GroupId | null) {
    if (!supportsGroups) return;
    
    if (groupId && groups) {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        const context: GroupContext = { groupId, role: 'admin' };
        evolu.setCurrentGroup(context);
        console.log('Current group set:', context);
      }
    } else {
      evolu.setCurrentGroup(null);
      console.log('Current group cleared');
    }
  }
  
  // Selected group state
  let selectedGroup: any = null;
  let selectedGroupMembers: any[] = [];
  let selectedGroupLoading = false;
  let inviteRole: 'admin' | 'member' = 'member';
  let generatedInviteCode: string | null = null;
  let inviteError: string | null = null;
  
  async function loadSelectedGroup() {
    if (!selectedGroupId || !supportsGroups) return;
    
    selectedGroupLoading = true;
    try {
      const groupResult = await evolu.getGroup(selectedGroupId);
      if (groupResult.ok) {
        selectedGroup = groupResult.value;
      }
      
      const membersResult = await evolu.getGroupMembers(selectedGroupId);
      if (membersResult.ok) {
        selectedGroupMembers = membersResult.value;
      }
    } catch (error) {
      console.error('Error loading group details:', error);
    } finally {
      selectedGroupLoading = false;
    }
  }
  
  // Watch for selected group changes
  $: if (selectedGroupId) {
    loadSelectedGroup();
  } else {
    selectedGroup = null;
    selectedGroupMembers = [];
  }
  
  async function handleGenerateInvite() {
    if (!selectedGroupId || !supportsGroups) return;
    
    inviteError = null;
    generatedInviteCode = null;
    
    try {
      const result = await evolu.generateGroupInvite(selectedGroupId, inviteRole, 24, 10);
      if (result.ok) {
        generatedInviteCode = result.value.inviteCode;
        console.log('Invite generated:', result.value.inviteCode);
      } else {
        inviteError = `Failed to generate invite: ${result.error.type}`;
        console.error('Generate invite error:', result.error);
      }
    } catch (error) {
      inviteError = `Unexpected error: ${error}`;
      console.error('Unexpected error:', error);
    }
  }
  
  function closeDetails() {
    selectedGroupId = null;
    generatedInviteCode = null;
    inviteError = null;
  }
</script>

<div class="groups-demo" data-testid="groups-demo">
  <h2>Groups Demo</h2>
  
  {#if !supportsGroups}
    <p class="error">Groups are not enabled in this Evolu instance.</p>
    <p class="hint">Enable groups by setting `enableGroups: true` in the Evolu config.</p>
  {:else}
    <!-- Current Group Display -->
    <section class="current-group-section">
      <h3>Current Group Context</h3>
      {#if currentGroup}
        <div data-testid="current-group">
          <p>Group ID: <code>{currentGroup.groupId}</code></p>
          <p>Role: <code>{currentGroup.role}</code></p>
          <button on:click={() => handleSetCurrentGroup(null)}>Clear Context</button>
        </div>
      {:else}
        <p data-testid="no-current-group">No group context selected</p>
      {/if}
    </section>

    <!-- Create Group -->
    <section class="create-group-section">
      <h3>Create New Group</h3>
      <div class="form-group">
        <input
          type="text"
          bind:value={newGroupName}
          placeholder="Group name"
          data-testid="group-name-input"
        />
        <button 
          on:click={handleCreateGroup}
          disabled={!newGroupName.trim()}
          data-testid="create-group-button"
        >
          Create Group
        </button>
      </div>
      {#if createError}
        <p class="error" data-testid="create-error">{createError}</p>
      {/if}
    </section>

    <!-- Join Group -->
    <section class="join-group-section">
      <h3>Join Group</h3>
      <div class="form-group">
        <input
          type="text"
          bind:value={inviteCode}
          placeholder="Invite code"
          data-testid="invite-code-input"
        />
        <button 
          on:click={handleJoinGroup}
          disabled={!inviteCode.trim()}
          data-testid="join-group-button"
        >
          Join Group
        </button>
      </div>
      {#if joinError}
        <p class="error" data-testid="join-error">{joinError}</p>
      {/if}
    </section>

    <!-- Groups List -->
    <section class="groups-list-section">
      <h3>My Groups</h3>
      {#if loading}
        <p data-testid="groups-loading">Loading groups...</p>
      {:else if groups.length === 0}
        <p data-testid="no-groups">No groups yet</p>
      {:else}
        <ul class="groups-list" data-testid="groups-list">
          {#each groups as group}
            <li class="group-item">
              <span>{group.name}</span>
              <button 
                on:click={() => selectedGroupId = group.id}
                data-testid="view-group-{group.id}"
              >
                View Details
              </button>
              <button 
                on:click={() => handleSetCurrentGroup(group.id)}
                class:active={currentGroup?.groupId === group.id}
                data-testid="set-context-{group.id}"
              >
                {currentGroup?.groupId === group.id ? 'Current' : 'Set as Current'}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Selected Group Details -->
    {#if selectedGroupId}
      <div class="group-details-overlay">
        <div class="group-details" data-testid="group-details">
          <h3>Group: {selectedGroup?.name || 'Loading...'}</h3>
          <button on:click={closeDetails}>Close</button>
          
          {#if selectedGroupLoading}
            <p data-testid="group-details-loading">Loading group details...</p>
          {:else if !selectedGroup}
            <p data-testid="group-not-found">Group not found</p>
          {:else}
            <div class="group-info">
              <p>ID: <code>{selectedGroup.id}</code></p>
              <p>Created: {new Date(selectedGroup.createdAt).toLocaleDateString()}</p>
              <p>Current Epoch: {selectedGroup.currentEpoch}</p>
            </div>

            <h4>Members ({selectedGroupMembers.length})</h4>
            <ul class="members-list" data-testid="members-list">
              {#each selectedGroupMembers as member}
                <li data-testid="member-{member.userId}">
                  {member.userId} - <strong>{member.role}</strong>
                </li>
              {/each}
            </ul>

            <h4>Generate Invite</h4>
            <div class="invite-section">
              <select 
                bind:value={inviteRole}
                data-testid="invite-role-select"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button on:click={handleGenerateInvite} data-testid="generate-invite-button">
                Generate Invite Code
              </button>
              
              {#if generatedInviteCode}
                <div class="invite-code" data-testid="invite-code-display">
                  <p>Invite Code:</p>
                  <code>{generatedInviteCode}</code>
                  <button on:click={() => navigator.clipboard.writeText(generatedInviteCode)}>
                    Copy to Clipboard
                  </button>
                </div>
              {/if}
              
              {#if inviteError}
                <p class="error" data-testid="invite-error">{inviteError}</p>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .groups-demo {
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
  }

  .groups-demo section {
    margin-bottom: 30px;
    padding: 15px;
    border: 1px solid #ddd;
    border-radius: 5px;
  }

  .groups-demo h3 {
    margin-top: 0;
  }

  .form-group {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
  }

  .form-group input {
    flex: 1;
    padding: 5px 10px;
  }

  .groups-list {
    list-style: none;
    padding: 0;
  }

  .group-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border: 1px solid #eee;
    margin-bottom: 5px;
  }

  .group-item span {
    flex: 1;
  }

  .error {
    color: red;
  }

  .hint {
    color: #666;
    font-style: italic;
  }

  button.active {
    background-color: #4CAF50;
    color: white;
  }

  .group-details-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .group-details {
    background: white;
    padding: 20px;
    border: 2px solid #333;
    border-radius: 10px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .invite-code {
    margin-top: 10px;
    padding: 10px;
    background: #f5f5f5;
    border-radius: 5px;
  }

  .invite-code code {
    display: block;
    margin: 10px 0;
    padding: 10px;
    background: #333;
    color: #fff;
    border-radius: 3px;
    word-break: break-all;
  }

  .members-list {
    list-style: none;
    padding: 0;
  }

  .members-list li {
    padding: 5px 0;
  }
</style>