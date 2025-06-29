import { useState } from "react";

// Mock implementation for demo purposes
export function GroupsDemoMock() {
  const [groups, setGroups] = useState<Array<{ id: string; name: string; createdAt: Date; currentEpoch: number }>>([]);
  const [currentGroup, setCurrentGroup] = useState<{ groupId: string; role: string } | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Array<{ id: string; userId: string; role: string }>>>({});
  const [generatedInvites, setGeneratedInvites] = useState<Record<string, string>>({});

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    
    setCreateError(null);
    const newGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName,
      createdAt: new Date(),
      currentEpoch: 1
    };
    
    setGroups([...groups, newGroup]);
    setMembers({
      ...members,
      [newGroup.id]: [{ id: `member-${Date.now()}`, userId: 'current-user', role: 'admin' }]
    });
    
    console.log("Group created:", newGroup);
    setNewGroupName("");
    setSelectedGroupId(newGroup.id);
  };

  const handleJoinGroup = () => {
    if (!inviteCode.trim()) return;
    
    setJoinError(null);
    
    // Simulate invalid code
    if (!inviteCode.startsWith('invite-')) {
      setJoinError("Failed to join group: InvalidInviteCode");
      console.error("Join group error: InvalidInviteCode");
      return;
    }
    
    // Simulate successful join
    const mockGroup = {
      id: `group-${Date.now()}`,
      name: `Joined Group ${groups.length + 1}`,
      createdAt: new Date(),
      currentEpoch: 1
    };
    
    setGroups([...groups, mockGroup]);
    setMembers({
      ...members,
      [mockGroup.id]: [
        { id: `member-1`, userId: 'owner', role: 'admin' },
        { id: `member-${Date.now()}`, userId: 'current-user', role: 'member' }
      ]
    });
    
    console.log("Joined group successfully");
    setInviteCode("");
  };

  const handleSetCurrentGroup = (groupId: string | null) => {
    if (groupId) {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        const context = { groupId, role: "admin" };
        setCurrentGroup(context);
        console.log("Current group set:", context);
      }
    } else {
      setCurrentGroup(null);
      console.log("Current group cleared");
    }
  };

  const handleGenerateInvite = (groupId: string, role: string) => {
    const inviteCode = `invite-${groupId}-${role}-${Date.now()}`;
    setGeneratedInvites({ ...generatedInvites, [groupId]: inviteCode });
    console.log("Invite generated:", inviteCode);
    return inviteCode;
  };

  const selectedGroup = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : null;
  const selectedGroupMembers = selectedGroupId ? (members[selectedGroupId] || []) : [];

  return (
    <div className="groups-demo" data-testid="groups-demo">
      <h2>Groups Demo</h2>
      
      {/* Current Group Display */}
      <section className="current-group-section">
        <h3>Current Group Context</h3>
        {currentGroup ? (
          <div data-testid="current-group">
            <p>Group ID: <code>{currentGroup.groupId}</code></p>
            <p>Role: <code>{currentGroup.role}</code></p>
            <button onClick={() => handleSetCurrentGroup(null)}>Clear Context</button>
          </div>
        ) : (
          <p data-testid="no-current-group">No group context selected</p>
        )}
      </section>

      {/* Create Group */}
      <section className="create-group-section">
        <h3>Create New Group</h3>
        <div className="form-group">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name"
            data-testid="group-name-input"
          />
          <button 
            onClick={handleCreateGroup}
            disabled={!newGroupName.trim()}
            data-testid="create-group-button"
          >
            Create Group
          </button>
        </div>
        {createError && (
          <p className="error" data-testid="create-error">{createError}</p>
        )}
      </section>

      {/* Join Group */}
      <section className="join-group-section">
        <h3>Join Group</h3>
        <div className="form-group">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Invite code"
            data-testid="invite-code-input"
          />
          <button 
            onClick={handleJoinGroup}
            disabled={!inviteCode.trim()}
            data-testid="join-group-button"
          >
            Join Group
          </button>
        </div>
        {joinError && (
          <p className="error" data-testid="join-error">{joinError}</p>
        )}
      </section>

      {/* Groups List */}
      <section className="groups-list-section">
        <h3>My Groups</h3>
        {groups.length === 0 ? (
          <p data-testid="no-groups">No groups yet</p>
        ) : (
          <ul className="groups-list" data-testid="groups-list">
            {groups.map((group) => (
              <li key={group.id} className="group-item">
                <span>{group.name}</span>
                <button 
                  onClick={() => setSelectedGroupId(group.id)}
                  data-testid={`view-group-${group.id}`}
                >
                  View Details
                </button>
                <button 
                  onClick={() => handleSetCurrentGroup(group.id)}
                  className={currentGroup?.groupId === group.id ? "active" : ""}
                  data-testid={`set-context-${group.id}`}
                >
                  {currentGroup?.groupId === group.id ? "Current" : "Set as Current"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Selected Group Details */}
      {selectedGroupId && selectedGroup && (
        <GroupDetailsMock 
          group={selectedGroup}
          members={selectedGroupMembers}
          onClose={() => setSelectedGroupId(null)}
          onGenerateInvite={handleGenerateInvite}
          existingInvite={generatedInvites[selectedGroupId]}
        />
      )}
    </div>
  );
}

function GroupDetailsMock({ 
  group, 
  members,
  onClose,
  onGenerateInvite,
  existingInvite
}: { 
  group: any;
  members: any[];
  onClose: () => void;
  onGenerateInvite: (groupId: string, role: string) => string;
  existingInvite?: string;
}) {
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteCode, setInviteCode] = useState<string | null>(existingInvite || null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleGenerateInvite = () => {
    setInviteError(null);
    const code = onGenerateInvite(group.id, inviteRole);
    setInviteCode(code);
  };

  return (
    <div className="group-details" data-testid="group-details">
      <h3>Group: {group.name}</h3>
      <button onClick={onClose}>Close</button>
      
      <div className="group-info">
        <p>ID: <code>{group.id}</code></p>
        <p>Created: {group.createdAt.toLocaleDateString()}</p>
        <p>Current Epoch: {group.currentEpoch}</p>
      </div>

      <h4>Members ({members.length})</h4>
      <ul className="members-list" data-testid="members-list">
        {members.map((member) => (
          <li key={member.id} data-testid={`member-${member.userId}`}>
            {member.userId} - <strong>{member.role}</strong>
          </li>
        ))}
      </ul>

      <h4>Generate Invite</h4>
      <div className="invite-section">
        <select 
          value={inviteRole} 
          onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
          data-testid="invite-role-select"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={handleGenerateInvite} data-testid="generate-invite-button">
          Generate Invite Code
        </button>
        
        {inviteCode && (
          <div className="invite-code" data-testid="invite-code-display">
            <p>Invite Code:</p>
            <code>{inviteCode}</code>
            <button onClick={() => navigator.clipboard.writeText(inviteCode)}>
              Copy to Clipboard
            </button>
          </div>
        )}
        
        {inviteError && (
          <p className="error" data-testid="invite-error">{inviteError}</p>
        )}
      </div>
    </div>
  );
}

// Add the same styles as before
const styles = `
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

  .group-details {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border: 2px solid #333;
    border-radius: 10px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    z-index: 1000;
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
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('groups-demo-mock-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'groups-demo-mock-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}