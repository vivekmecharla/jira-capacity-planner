import React, { useState, useEffect } from 'react';
import { Plus, Trash2, UserPlus, Search, Edit2, Download, Users, CheckSquare, Square, Loader } from 'lucide-react';
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

  // Import from Jira Team state
  const [showImportModal, setShowImportModal] = useState(false);
  const [jiraTeams, setJiraTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembersPreview, setTeamMembersPreview] = useState([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [selectedImportMembers, setSelectedImportMembers] = useState({});
  const [importBoardId, setImportBoardId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importTeamSearch, setImportTeamSearch] = useState('');

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
      
      // Use response data directly to update state
      const updatedMembers = response.data;
      setTeamMembers(updatedMembers);
      
      // Find the newly added member and open edit modal
      const newMember = updatedMembers?.find(m => m.accountId === user.accountId);
      
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
        const response = await configApi.removeTeamMember(accountId);
        setTeamMembers(response.data);
      } catch (err) {
        console.error('Failed to remove team member:', err);
      }
    }
  };

  const updateMemberRole = async (accountId, role, roleAllocation) => {
    try {
      const response = await configApi.updateTeamMember(accountId, { role, roleAllocation });
      setTeamMembers(response.data);
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
      const response = await configApi.updateTeamMember(editingMember.accountId, {
        role: editForm.role,
        roleAllocation: editForm.roleAllocation,
        boardAssignments: editForm.boardAssignments
      });
      setTeamMembers(response.data);
      closeEditModal();
    } catch (err) {
      console.error('Failed to update team member:', err);
    }
  };

  // --- Import from Jira Team functions ---
  const openImportModal = async () => {
    setShowImportModal(true);
    setSelectedTeam(null);
    setTeamMembersPreview([]);
    setSelectedImportMembers({});
    setImportBoardId(selectedBoard?.id || null);
    setTeamsError(null);
    setImportTeamSearch('');
    await loadJiraTeams();
  };

  const loadJiraTeams = async () => {
    setTeamsLoading(true);
    setTeamsError(null);
    try {
      const response = await jiraApi.getTeams();
      setJiraTeams(response.data || []);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setTeamsError(msg);
      setJiraTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  };

  const selectTeamForImport = async (team) => {
    setSelectedTeam(team);
    setTeamMembersPreview([]);
    setSelectedImportMembers({});
    setTeamMembersLoading(true);
    try {
      const response = await jiraApi.getTeamMembers(team.teamId);
      const members = response.data || [];
      setTeamMembersPreview(members);
      // Pre-select members not already in the team
      const selections = {};
      members.forEach(m => {
        if (!teamMembers.some(tm => tm.accountId === m.accountId)) {
          selections[m.accountId] = true;
        }
      });
      setSelectedImportMembers(selections);
    } catch (err) {
      console.error('Failed to load team members:', err);
    } finally {
      setTeamMembersLoading(false);
    }
  };

  const toggleImportMember = (accountId) => {
    setSelectedImportMembers(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const selectAllImportMembers = () => {
    const selections = {};
    teamMembersPreview.forEach(m => {
      if (!teamMembers.some(tm => tm.accountId === m.accountId)) {
        selections[m.accountId] = true;
      }
    });
    setSelectedImportMembers(selections);
  };

  const deselectAllImportMembers = () => {
    setSelectedImportMembers({});
  };

  const importSelectedMembers = async () => {
    const toImport = teamMembersPreview.filter(m => selectedImportMembers[m.accountId]);
    if (toImport.length === 0) return;

    setImporting(true);
    try {
      const board = importBoardId ? allBoards.find(b => b.id === importBoardId) : null;

      const membersToAdd = toImport.map(user => {
        const memberData = {
          accountId: user.accountId,
          displayName: user.displayName,
          emailAddress: user.emailAddress,
          avatarUrl: user.avatarUrls?.['32x32'],
          role: 'Developer',
          roleAllocation: 1
        };

        if (board) {
          memberData.boardAssignments = [{
            boardId: board.id,
            boardName: board.name,
            projectKey: board.location?.projectKey || '',
            projectName: board.location?.projectName || ''
          }];
        }

        return memberData;
      });

      const response = await configApi.bulkAddTeamMembers(membersToAdd);
      setTeamMembers(response.data);
      setShowImportModal(false);
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setImporting(false);
    }
  };

  const filteredJiraTeams = jiraTeams.filter(t => {
    if (!importTeamSearch.trim()) return true;
    const q = importTeamSearch.toLowerCase();
    return (t.displayName || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
  });

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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={openImportModal}>
              <Download size={16} />
              Import from Jira Team
            </button>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <UserPlus size={16} />
              Add Member
            </button>
          </div>
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
      {/* Import from Jira Team Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => !importing && setShowImportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                <Users size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Import from Jira Team
              </h3>
              <button className="modal-close" onClick={() => !importing && setShowImportModal(false)}>×</button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Error message */}
              {teamsError && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontSize: '13px', color: 'var(--accent-red)' }}>
                  {teamsError}
                </div>
              )}

              {/* Team selector */}
              {!selectedTeam ? (
                <>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Select a Jira Team to import members from:
                  </div>

                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input"
                      placeholder="Search teams..."
                      value={importTeamSearch}
                      onChange={(e) => setImportTeamSearch(e.target.value)}
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>

                  {teamsLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <Loader size={16} className="spin" /> Loading teams...
                    </div>
                  ) : (
                    <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {filteredJiraTeams.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                          {jiraTeams.length === 0 ? 'No teams found in your organization.' : 'No teams match your search.'}
                        </div>
                      ) : (
                        filteredJiraTeams.map(team => (
                          <div
                            key={team.teamId}
                            onClick={() => selectTeamForImport(team)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '12px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              background: 'var(--bg-tertiary)',
                              border: '1px solid var(--border-color)',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                          >
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Users size={18} style={{ color: 'var(--accent-blue)' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>{team.displayName}</div>
                              {team.description && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.description}</div>
                              )}
                            </div>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: team.state === 'ACTIVE' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(156, 163, 175, 0.15)', color: team.state === 'ACTIVE' ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: '600' }}>
                              {team.state || 'ACTIVE'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Selected team header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users size={18} style={{ color: 'var(--accent-blue)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{selectedTeam.displayName}</div>
                      {selectedTeam.description && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedTeam.description}</div>
                      )}
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setSelectedTeam(null); setTeamMembersPreview([]); setSelectedImportMembers({}); }}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                    >
                      Change
                    </button>
                  </div>

                  {/* Board auto-assignment */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>Auto-assign to board (optional)</label>
                    <select
                      className="select"
                      value={importBoardId || ''}
                      onChange={(e) => setImportBoardId(e.target.value ? parseInt(e.target.value) : null)}
                      style={{ fontSize: '12px' }}
                    >
                      <option value="">No board assignment</option>
                      {allBoards.map(board => (
                        <option key={board.id} value={board.id}>
                          {board.name}{board.location?.projectName ? ` (${board.location.projectName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Members preview */}
                  {teamMembersLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <Loader size={16} className="spin" /> Loading team members...
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                          Members ({teamMembersPreview.length})
                          {Object.values(selectedImportMembers).filter(Boolean).length > 0 && (
                            <span style={{ color: 'var(--accent-blue)', marginLeft: '4px' }}>
                              — {Object.values(selectedImportMembers).filter(Boolean).length} selected
                            </span>
                          )}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={selectAllImportMembers} className="btn btn-secondary" style={{ fontSize: '10px', padding: '2px 6px' }}>Select All</button>
                          <button onClick={deselectAllImportMembers} className="btn btn-secondary" style={{ fontSize: '10px', padding: '2px 6px' }}>Deselect All</button>
                        </div>
                      </div>

                      <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {teamMembersPreview.map(member => {
                          const alreadyAdded = teamMembers.some(tm => tm.accountId === member.accountId);
                          const isSelected = selectedImportMembers[member.accountId];
                          return (
                            <label
                              key={member.accountId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                cursor: alreadyAdded ? 'default' : 'pointer',
                                fontSize: '13px',
                                background: alreadyAdded ? 'var(--bg-tertiary)' : isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)',
                                border: alreadyAdded ? '1px solid var(--border-color)' : isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
                                opacity: alreadyAdded ? 0.6 : 1,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {alreadyAdded ? (
                                <CheckSquare size={16} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={!!isSelected}
                                  onChange={() => toggleImportMember(member.accountId)}
                                  style={{ margin: 0, flexShrink: 0 }}
                                />
                              )}
                              <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '12px', lineHeight: '28px', flexShrink: 0 }}>
                                {member.displayName?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {member.displayName}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {member.emailAddress || ''}
                                </div>
                              </div>
                              {alreadyAdded && (
                                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--accent-green)', fontWeight: '600', flexShrink: 0 }}>
                                  Already added
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Import button */}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => !importing && setShowImportModal(false)} disabled={importing}>Cancel</button>
                    <button
                      className="btn btn-primary"
                      onClick={importSelectedMembers}
                      disabled={importing || Object.values(selectedImportMembers).filter(Boolean).length === 0}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {importing ? (
                        <><Loader size={14} className="spin" /> Importing...</>
                      ) : (
                        <><Download size={14} /> Import {Object.values(selectedImportMembers).filter(Boolean).length} Member{Object.values(selectedImportMembers).filter(Boolean).length !== 1 ? 's' : ''}</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamConfig;
