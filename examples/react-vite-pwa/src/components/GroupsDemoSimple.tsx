import { useState, useEffect } from "react";
import { type GroupId, type GroupContext } from "@evolu/common";

interface GroupsDemoSimpleProps {
  evolu: any;
}

export function GroupsDemoSimple({ evolu }: GroupsDemoSimpleProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [currentGroup, setCurrentGroup] = useState<GroupContext | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<GroupId | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if groups are supported by checking if methods exist
  const supportsGroups = !!(evolu.createGroup && evolu.joinGroup && evolu.listGroups);
  
  if (!supportsGroups) {
    return (
      <div className="groups-demo">
        <h2>Groups Demo</h2>
        <p className="error">Groups are not enabled in this Evolu instance.</p>
        <p className="hint">Enable groups by setting `enableGroups: true` in the Evolu config.</p>
      </div>
    );
  }

  // Load groups on mount and subscribe to changes
  useEffect(() => {
    let cancelled = false;

    const loadGroups = async () => {
      setLoading(true);
      try {
        const result = await evolu.listGroups();
        if (!cancelled && result.ok) {
          setGroups(result.value);
        }
      } catch (error) {
        console.error("Error loading groups:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // Initial load
    loadGroups();

    // Subscribe to current group changes
    const unsubscribe = evolu.subscribeCurrentGroup(() => {
      if (!cancelled) {
        setCurrentGroup(evolu.getCurrentGroup());
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [evolu]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    
    setCreateError(null);
    try {
      const result = await evolu.createGroup(newGroupName);
      if (result.ok) {
        console.log("Group created:", result.value);
        setNewGroupName("");
        setSelectedGroupId(result.value.id);
        // Reload groups
        const groupsResult = await evolu.listGroups();
        if (groupsResult.ok) {
          setGroups(groupsResult.value);
        }
      } else {
        setCreateError(`Failed to create group: ${result.error.type}`);
        console.error("Create group error:", result.error);
      }
    } catch (error) {
      setCreateError(`Unexpected error: ${error}`);
      console.error("Unexpected error:", error);
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) return;
    
    setJoinError(null);
    try {
      const result = await evolu.joinGroup(inviteCode);
      if (result.ok) {
        console.log("Joined group successfully");
        setInviteCode("");
        // Reload groups
        const groupsResult = await evolu.listGroups();
        if (groupsResult.ok) {
          setGroups(groupsResult.value);
        }
      } else {
        setJoinError(`Failed to join group: ${result.error.type}`);
        console.error("Join group error:", result.error);
      }
    } catch (error) {
      setJoinError(`Unexpected error: ${error}`);
      console.error("Unexpected error:", error);
    }
  };

  const handleSetCurrentGroup = (groupId: GroupId | null) => {
    if (groupId) {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        // For demo, assume user is admin
        const context: GroupContext = { groupId, role: "admin" };
        evolu.setCurrentGroup(context);
        console.log("Current group set:", context);
      }
    } else {
      evolu.setCurrentGroup(null);
      console.log("Current group cleared");
    }
  };

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
        {loading ? (
          <p data-testid="groups-loading">Loading groups...</p>
        ) : groups.length === 0 ? (
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
      {selectedGroupId && (
        <GroupDetailsSimple 
          groupId={selectedGroupId} 
          evolu={evolu}
          onClose={() => setSelectedGroupId(null)} 
        />
      )}
    </div>
  );
}

function GroupDetailsSimple({ 
  groupId, 
  evolu,
  onClose 
}: { 
  groupId: GroupId; 
  evolu: any;
  onClose: () => void 
}) {
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadGroupDetails = async () => {
      setLoading(true);
      try {
        // Load group details
        const groupResult = await evolu.getGroup(groupId);
        if (!cancelled && groupResult.ok) {
          setGroup(groupResult.value);
        }

        // Load members
        const membersResult = await evolu.getGroupMembers(groupId);
        if (!cancelled && membersResult.ok) {
          setMembers(membersResult.value);
        }
      } catch (error) {
        console.error("Error loading group details:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGroupDetails();

    return () => {
      cancelled = true;
    };
  }, [groupId, evolu]);

  const handleGenerateInvite = async () => {
    setInviteError(null);
    setInviteCode(null);
    
    try {
      const result = await evolu.generateGroupInvite(groupId, inviteRole, 24, 10);
      if (result.ok) {
        setInviteCode(result.value.inviteCode);
        console.log("Invite generated:", result.value.inviteCode);
      } else {
        setInviteError(`Failed to generate invite: ${result.error.type}`);
        console.error("Generate invite error:", result.error);
      }
    } catch (error) {
      setInviteError(`Unexpected error: ${error}`);
      console.error("Unexpected error:", error);
    }
  };

  if (loading) {
    return <div data-testid="group-details-loading">Loading group details...</div>;
  }

  if (!group) {
    return <div data-testid="group-not-found">Group not found</div>;
  }

  return (
    <div className="group-details" data-testid="group-details">
      <h3>Group: {group.name}</h3>
      <button onClick={onClose}>Close</button>
      
      <div className="group-info">
        <p>ID: <code>{group.id}</code></p>
        <p>Created: {new Date(group.createdAt).toLocaleDateString()}</p>
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
if (typeof document !== 'undefined' && !document.getElementById('groups-demo-simple-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'groups-demo-simple-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}