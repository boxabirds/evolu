<script lang="ts">
  // Mock implementation for demo purposes
  let groups: Array<{ id: string; name: string; createdAt: Date; currentEpoch: number }> = [];
  let currentGroup: { groupId: string; role: string } | null = null;
  let selectedGroupId: string | null = null;
  let newGroupName = '';
  let inviteCode = '';
  let createError: string | null = null;
  let joinError: string | null = null;
  let members: Record<string, Array<{ id: string; userId: string; role: string }>> = {};
  let generatedInvites: Record<string, string> = {};
  
  function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    
    createError = null;
    const newGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName,
      createdAt: new Date(),
      currentEpoch: 1
    };
    
    groups = [...groups, newGroup];
    members[newGroup.id] = [{ id: `member-${Date.now()}`, userId: 'current-user', role: 'admin' }];
    
    console.log('Group created:', newGroup);
    newGroupName = '';
    selectedGroupId = newGroup.id;
  }
  
  function handleJoinGroup() {
    if (!inviteCode.trim()) return;
    
    joinError = null;
    
    // Simulate invalid code
    if (!inviteCode.startsWith('invite-')) {
      joinError = 'Failed to join group: InvalidInviteCode';
      console.error('Join group error: InvalidInviteCode');
      return;
    }
    
    // Simulate successful join
    const mockGroup = {
      id: `group-${Date.now()}`,
      name: `Joined Group ${groups.length + 1}`,
      createdAt: new Date(),
      currentEpoch: 1
    };
    
    groups = [...groups, mockGroup];
    members[mockGroup.id] = [
      { id: `member-1`, userId: 'owner', role: 'admin' },
      { id: `member-${Date.now()}`, userId: 'current-user', role: 'member' }
    ];
    
    console.log('Joined group successfully');
    inviteCode = '';
  }
  
  function handleSetCurrentGroup(groupId: string | null) {
    if (groupId) {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        currentGroup = { groupId, role: 'admin' };
        console.log('Current group set:', currentGroup);
      }
    } else {
      currentGroup = null;
      console.log('Current group cleared');
    }
  }
  
  function handleGenerateInvite(groupId: string, role: string) {
    const inviteCode = `invite-${groupId}-${role}-${Date.now()}`;
    generatedInvites[groupId] = inviteCode;
    console.log('Invite generated:', inviteCode);
    return inviteCode;
  }
  
  function closeDetails() {
    selectedGroupId = null;
  }
  
  // Reactive declarations
  $: selectedGroup = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : null;
  $: selectedGroupMembers = selectedGroupId ? (members[selectedGroupId] || []) : [];
  
  // Group details state
  let inviteRole: 'admin' | 'member' = 'member';
  let inviteError: string | null = null;
  
  $: displayedInviteCode = selectedGroupId ? generatedInvites[selectedGroupId] || null : null;
</script>

<div class="groups-demo" data-testid="groups-demo">
  <h2>Groups Demo</h2>
  
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
    {#if groups.length === 0}
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
  {#if selectedGroupId && selectedGroup}
    <div class="group-details-overlay">
      <div class="group-details" data-testid="group-details">
        <h3>Group: {selectedGroup.name}</h3>
        <button on:click={closeDetails}>Close</button>
        
        <div class="group-info">
          <p>ID: <code>{selectedGroup.id}</code></p>
          <p>Created: {selectedGroup.createdAt.toLocaleDateString()}</p>
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
          <button 
            on:click={() => displayedInviteCode = handleGenerateInvite(selectedGroup.id, inviteRole)} 
            data-testid="generate-invite-button"
          >
            Generate Invite Code
          </button>
          
          {#if displayedInviteCode}
            <div class="invite-code" data-testid="invite-code-display">
              <p>Invite Code:</p>
              <code>{displayedInviteCode}</code>
              <button on:click={() => navigator.clipboard.writeText(displayedInviteCode)}>
                Copy to Clipboard
              </button>
            </div>
          {/if}
          
          {#if inviteError}
            <p class="error" data-testid="invite-error">{inviteError}</p>
          {/if}
        </div>
      </div>
    </div>
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
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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