import React, { useState, useEffect } from 'react';
import { Plus, Trash2, UserPlus, Search } from 'lucide-react';
import { jiraApi, configApi } from '../api';

function TeamConfig({ boards, selectedBoard }) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [jiraUsers, setJiraUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projectKey, setProjectKey] = useState('');

  useEffect(() => {
    loadTeamMembers();
  }, []);

  useEffect(() => {
    const key = selectedBoard?.location?.projectKey;
    if (key) {
      setProjectKey(key);
      loadJiraUsers(key);
    }
  }, [selectedBoard]);

  const handleLoadUsers = () => {
    if (projectKey.trim()) {
      loadJiraUsers(projectKey.trim());
    }
  };

  const loadTeamMembers = async () => {
    try {
      const response = await configApi.getTeam();
      setTeamMembers(response.data);
    } catch (err) {
      console.error('Failed to load team members:', err);
    }
  };

  const loadJiraUsers = async (projectKey) => {
    try {
      const response = await jiraApi.getProjectUsers(projectKey);
      setJiraUsers(response.data);
    } catch (err) {
      console.error('Failed to load Jira users:', err);
    }
  };

  const addMember = async (user) => {
    try {
      await configApi.addTeamMember({
        accountId: user.accountId,
        displayName: user.displayName,
        emailAddress: user.emailAddress,
        avatarUrl: user.avatarUrls?.['32x32'],
        role: 'Developer',
        roleAllocation: 1
      });
      loadTeamMembers();
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add team member:', err);
    }
  };

  const removeMember = async (accountId) => {
    if (window.confirm('Are you sure you want to remove this team member?')) {
      try {
        await configApi.removeTeamMember(accountId);
        loadTeamMembers();
      } catch (err) {
        console.error('Failed to remove team member:', err);
      }
    }
  };

  const updateMemberRole = async (accountId, role, roleAllocation) => {
    try {
      await configApi.updateTeamMember(accountId, { role, roleAllocation });
      loadTeamMembers();
    } catch (err) {
      console.error('Failed to update member role:', err);
    }
  };

  const getRoleAllocation = (role) => {
    switch(role) {
      case 'Dev Lead': return 0.5;
      case 'QA Lead': return 0.5;
      case 'Sprint Head': return 0;
      default: return 1;
    }
  };

  const filteredUsers = jiraUsers.filter(user => 
    !teamMembers.some(m => m.accountId === user.accountId) &&
    (user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     user.emailAddress?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div>
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">Load Users from Project</h3>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            className="input"
            placeholder="Enter project key (e.g., CPT, CORE)"
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
            style={{ maxWidth: '300px' }}
          />
          <button className="btn btn-primary" onClick={handleLoadUsers}>
            Load Users
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {jiraUsers.length > 0 ? `${jiraUsers.length} users loaded` : 'No users loaded'}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Team Members ({teamMembers.length})</h3>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <UserPlus size={16} />
            Add Member
          </button>
        </div>

        {teamMembers.length === 0 ? (
          <div className="empty-state">
            <p>No team members configured yet.</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Add team members to start tracking capacity.
            </p>
          </div>
        ) : (
          <div className="team-grid">
            {teamMembers.map(member => (
              <div key={member.accountId} className="team-card">
                <div className="team-card-header">
                  <div className="avatar">
                    {member.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="team-card-info">
                    <div className="team-card-name">{member.displayName}</div>
                    <div className="team-card-email">{member.emailAddress}</div>
                  </div>
                </div>
                <div className="team-card-role">
                  <select
                    className="select"
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                    value={member.role || 'Developer'}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      const newAllocation = newRole === 'Developer' || newRole === 'QA' 
                        ? member.roleAllocation || 1 
                        : getRoleAllocation(newRole);
                      updateMemberRole(member.accountId, newRole, newAllocation);
                    }}
                  >
                    <option value="Developer">Developer</option>
                    <option value="QA">QA</option>
                    <option value="Dev Lead">Dev Lead</option>
                    <option value="QA Lead">QA Lead</option>
                    <option value="Sprint Head">Sprint Head</option>
                  </select>
                  {(member.role === 'Developer' || member.role === 'QA' || !member.role) && (
                    <input
                      type="number"
                      className="input"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={member.roleAllocation || 1}
                      onChange={(e) => updateMemberRole(member.accountId, member.role || 'Developer', parseFloat(e.target.value))}
                      style={{ fontSize: '12px', padding: '4px 6px' }}
                    />
                  )}
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {member.roleAllocation ? `${(member.roleAllocation * 100).toFixed(0)}%` : '100%'}
                  </span>
                </div>
                <div className="team-card-actions">
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => removeMember(member.accountId)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Team Member</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>

            <div className="form-group">
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {filteredUsers.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px' }}>
                  <p style={{ fontSize: '13px' }}>
                    {jiraUsers.length === 0 
                      ? 'Select a board to load project users'
                      : 'No users found'}
                  </p>
                </div>
              ) : (
                filteredUsers.map(user => (
                  <div 
                    key={user.accountId} 
                    className="team-card" 
                    style={{ marginBottom: '8px', cursor: 'pointer' }}
                    onClick={() => addMember(user)}
                  >
                    <div className="avatar">
                      {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="team-card-info">
                      <div className="team-card-name">{user.displayName}</div>
                      <div className="team-card-email">{user.emailAddress}</div>
                    </div>
                    <Plus size={16} style={{ color: 'var(--accent-green)' }} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamConfig;
