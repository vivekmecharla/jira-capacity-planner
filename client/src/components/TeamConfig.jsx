import React, { useState, useEffect } from 'react';
import { Plus, Trash2, UserPlus, Search, Edit2 } from 'lucide-react';
import { jiraApi, configApi } from '../api';

function TeamConfig({ boards, selectedBoard }) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [jiraUsers, setJiraUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projectKey, setProjectKey] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState({ role: 'Developer', roleAllocation: 1, boardAssignments: [] });
  const [allBoards, setAllBoards] = useState([]);
  const [boardSearchQuery, setBoardSearchQuery] = useState('');

  useEffect(() => {
    loadTeamMembers();
    loadAllBoards();
  }, []);

  useEffect(() => {
    const key = selectedBoard?.location?.projectKey;
    if (key) {
      setProjectKey(key);
      loadJiraUsers(key);
    }
  }, [selectedBoard]);

  // Filter team members based on selected board
  const filteredTeamMembers = teamMembers.filter(member => {
    if (!selectedBoard) return true;
    
    // If member has no board assignments, include them in all boards (backward compatible)
    if (!member.boardAssignments || member.boardAssignments.length === 0) return true;
    
    return member.boardAssignments.some(ba => ba.boardId === selectedBoard.id);
  });

  const loadAllBoards = async () => {
    try {
      const response = await jiraApi.getBoards();
      setAllBoards(response.data || []);
    } catch (err) {
      console.error('Failed to load all boards:', err);
    }
  };

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
      const response = await configApi.addTeamMember({
        accountId: user.accountId,
        displayName: user.displayName,
        emailAddress: user.emailAddress,
        avatarUrl: user.avatarUrls?.['32x32'],
        role: 'Developer',
        roleAllocation: 1
      });
      
      // Load team members to get the newly added member data
      await loadTeamMembers();
      
      // Find the newly added member and open edit modal
      const newMember = response.data?.find(m => m.accountId === user.accountId) || 
                        teamMembers.find(m => m.accountId === user.accountId);
      
      if (newMember) {
        setShowAddModal(false);
        // Small delay to ensure modal transition is smooth
        setTimeout(() => openEditModal(newMember), 100);
      } else {
        setShowAddModal(false);
      }
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

  const openEditModal = (member) => {
    setEditingMember(member);
    setEditForm({
      role: member.role || 'Developer',
      roleAllocation: member.roleAllocation !== undefined ? member.roleAllocation : 1,
      boardAssignments: member.boardAssignments || []
    });
  };

  const closeEditModal = () => {
    setEditingMember(null);
    setEditForm({ role: 'Developer', roleAllocation: 1, boardAssignments: [] });
  };

  const handleEditFormRoleChange = (newRole) => {
    const newAllocation = newRole === 'Developer' || newRole === 'QA'
      ? editForm.roleAllocation || 1
      : getRoleAllocation(newRole);
    setEditForm({ ...editForm, role: newRole, roleAllocation: newAllocation });
  };

  const toggleBoardAssignment = (board) => {
    const existing = editForm.boardAssignments.find(ba => ba.boardId === board.id);
    if (existing) {
      setEditForm({
        ...editForm,
        boardAssignments: editForm.boardAssignments.filter(ba => ba.boardId !== board.id)
      });
    } else {
      setEditForm({
        ...editForm,
        boardAssignments: [
          ...editForm.boardAssignments,
          {
            boardId: board.id,
            boardName: board.name,
            projectKey: board.location?.projectKey || '',
            projectName: board.location?.projectName || ''
          }
        ]
      });
    }
  };

  const saveEditForm = async () => {
    if (!editingMember) return;
    try {
      await configApi.updateTeamMember(editingMember.accountId, {
        role: editForm.role,
        roleAllocation: editForm.roleAllocation,
        boardAssignments: editForm.boardAssignments
      });
      loadTeamMembers();
      closeEditModal();
    } catch (err) {
      console.error('Failed to update team member:', err);
    }
  };

  const filteredUsers = jiraUsers.filter(user => 
    !teamMembers.some(m => m.accountId === user.accountId) &&
    (user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     user.emailAddress?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredBoards = allBoards.filter(board => {
    if (!boardSearchQuery.trim()) return true;
    const query = boardSearchQuery.toLowerCase();
    return board.name?.toLowerCase().includes(query) ||
           board.location?.projectName?.toLowerCase().includes(query) ||
           board.location?.projectKey?.toLowerCase().includes(query);
  });

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            Team Members ({filteredTeamMembers.length}{selectedBoard ? ` of ${teamMembers.length}` : ''})
            {selectedBoard && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '400', marginLeft: '8px' }}>
                (filtered by {selectedBoard.name})
              </span>
            )}
          </h3>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <UserPlus size={16} />
            Add Member
          </button>
        </div>

        {filteredTeamMembers.length === 0 ? (
          <div className="empty-state">
            <p>
              {selectedBoard 
                ? 'No team members assigned to this board.'
                : 'No team members configured yet.'
              }
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
              {selectedBoard 
                ? 'Edit team members to assign them to this board, or add new members.'
                : 'Add team members to start tracking capacity.'
              }
            </p>
          </div>
        ) : (
          <div className="team-grid">
            {filteredTeamMembers.map(member => (
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
                {member.boardAssignments && member.boardAssignments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
                      Assigned Boards:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {member.boardAssignments.map(ba => (
                        <div
                          key={ba.boardId}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: 'rgba(59, 130, 246, 0.08)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            fontSize: '11px'
                          }}
                        >
                          <div style={{ fontWeight: '600', color: 'var(--accent-blue)' }}>
                            {ba.boardName}
                          </div>
                          {ba.projectName && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {ba.projectName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="team-card-actions">
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEditModal(member)}
                    title="Edit member"
                  >
                    <Edit2 size={14} />
                  </button>
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

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Team Member</h3>
              <button className="modal-close" onClick={closeEditModal}>×</button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div className="avatar">
                  {editingMember.displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{editingMember.displayName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{editingMember.emailAddress}</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="select"
                  value={editForm.role}
                  onChange={(e) => handleEditFormRoleChange(e.target.value)}
                >
                  <option value="Developer">Developer</option>
                  <option value="QA">QA</option>
                  <option value="Dev Lead">Dev Lead</option>
                  <option value="QA Lead">QA Lead</option>
                  <option value="Sprint Head">Sprint Head</option>
                </select>
              </div>

              {(editForm.role === 'Developer' || editForm.role === 'QA') && (
                <div className="form-group">
                  <label className="form-label">Role Allocation</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      className="input"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={editForm.roleAllocation}
                      onChange={(e) => setEditForm({ ...editForm, roleAllocation: parseFloat(e.target.value) })}
                      style={{ maxWidth: '100px' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {editForm.roleAllocation ? `${(editForm.roleAllocation * 100).toFixed(0)}%` : '100%'}
                    </span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Board Assignments</label>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Select the boards this member belongs to. If no boards are selected, the member will appear in all boards.
                </div>
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input"
                    placeholder="Search boards..."
                    value={boardSearchQuery}
                    onChange={(e) => setBoardSearchQuery(e.target.value)}
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filteredBoards.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px', textAlign: 'center' }}>
                      {boardSearchQuery.trim() 
                        ? `No boards found matching "${boardSearchQuery}"`
                        : 'No boards available. Boards will be loaded from Jira.'
                      }
                    </div>
                  ) : (
                    filteredBoards.map(board => {
                      const isAssigned = editForm.boardAssignments.some(ba => ba.boardId === board.id);
                      return (
                        <label
                          key={board.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            background: isAssigned ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                            border: isAssigned ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => toggleBoardAssignment(board)}
                            style={{ margin: 0 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '500' }}>{board.name}</div>
                            {board.location?.projectName && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {board.location.projectName}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={closeEditModal}>Cancel</button>
                <button className="btn btn-primary" onClick={saveEditForm}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
