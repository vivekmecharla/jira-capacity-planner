import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, User, RefreshCw, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { configApi } from '../api';
import { format } from 'date-fns';
import LeavesModal from './LeavesModal';

function HolidaysLeaves({ selectedBoard }) {
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zohoStatus, setZohoStatus] = useState({ configured: false, message: '' });
  const [error, setError] = useState(null);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '' });
  const [newLeave, setNewLeave] = useState({ accountId: '', startDate: '', endDate: '', reason: '', isHalfDay: false, halfDayType: '', isUnplanned: false });
  const [showManageLeavesModal, setShowManageLeavesModal] = useState(false);

  useEffect(() => {
    loadData();
    checkZohoStatus();
  }, []);

  const checkZohoStatus = async () => {
    try {
      const res = await configApi.getZohoStatus();
      setZohoStatus(res.data);
    } catch (err) {
      console.error('Failed to check Zoho status:', err);
      setZohoStatus({
        configured: false,
        working: false,
        message: 'Unable to check Zoho status - showing local data'
      });
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [holidaysRes, leavesRes, teamRes] = await Promise.all([
        configApi.getHolidays(),
        configApi.getLeaves(),
        configApi.getTeam()
      ]);
      setHolidays(holidaysRes.data);
      setLeaves(leavesRes.data);
      setTeamMembers(teamRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load data from Zoho. Please check your configuration.');
    } finally {
      setLoading(false);
    }
  };

  const addHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) return;
    try {
      await configApi.addHoliday(newHoliday);
      setNewHoliday({ name: '', date: '' });
      setShowHolidayModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to add holiday:', err);
    }
  };

  const removeHoliday = async (id) => {
    try {
      await configApi.removeHoliday(id);
      loadData();
    } catch (err) {
      console.error('Failed to remove holiday:', err);
    }
  };

  const addLeave = async () => {
    if (!newLeave.accountId || !newLeave.startDate || !newLeave.endDate) return;
    const member = teamMembers.find(m => m.accountId === newLeave.accountId);
    try {
      await configApi.addLeave({
        ...newLeave,
        memberName: member?.displayName
      });
      setNewLeave({ accountId: '', startDate: '', endDate: '', reason: '', isHalfDay: false, halfDayType: '', isUnplanned: false });
      setShowLeaveModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to add leave:', err);
    }
  };

  const removeLeave = async (id) => {
    try {
      await configApi.removeLeave(id);
      loadData();
    } catch (err) {
      console.error('Failed to remove leave:', err);
    }
  };

  // Filter team members based on selected board (same logic as TeamConfig)
  const filteredTeamMembers = teamMembers.filter(member => {
    if (!selectedBoard) return true;
    
    // If member has no board assignments, include them in all boards (backward compatible)
    if (!member.boardAssignments || member.boardAssignments.length === 0) return true;
    
    return member.boardAssignments.some(ba => ba.boardId === selectedBoard.id);
  });

  // Filter leaves to show only leaves of filtered team members
  const filteredLeaves = leaves.filter(leave => {
    if (!selectedBoard) return true;
    
    // Check if the leave belongs to a team member assigned to the selected board
    return filteredTeamMembers.some(member => member.accountId === leave.accountId);
  });

  return (
    <>
      {/* Zoho Status Banner */}
      <div className="card" style={{ marginBottom: '20px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {zohoStatus.working ? (
              <CheckCircle size={18} style={{ color: 'var(--accent-green)' }} />
            ) : (
              <AlertCircle size={18} style={{ color: 'var(--accent-yellow)' }} />
            )}
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {zohoStatus.message}
            </span>
          </div>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={loadData}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid var(--accent-red)' }}>
          <span style={{ fontSize: '13px', color: 'var(--accent-red)' }}>{error}</span>
        </div>
      )}

      <div className="grid grid-2">
        {/* Holidays Section */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Calendar size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Holidays
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {holidays.length} holidays
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowHolidayModal(true)}>
              <Plus size={14} />
              Add Holiday
            </button>
          </div>

          {loading ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <p style={{ fontSize: '13px' }}>Loading holidays...</p>
            </div>
          ) : holidays.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <p style={{ fontSize: '13px' }}>No holidays found</p>
            </div>
          ) : (
            <div className="holiday-list">
              {holidays
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(holiday => (
                  <div key={holiday.id} className="holiday-item">
                    <div>
                      <div className="holiday-date">
                        {format(new Date(holiday.date), 'EEEE, MMM d, yyyy')}
                      </div>
                      <div className="holiday-name">{holiday.name}</div>
                    </div>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => removeHoliday(holiday.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Leaves Section */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 className="card-title">
              <User size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Team Leaves
              {selectedBoard && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '400', marginLeft: '8px' }}>
                  (filtered by {selectedBoard.name})
                </span>
              )}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {filteredLeaves.length} leaves
                {selectedBoard && (
                  <span style={{ marginLeft: '4px', color: 'var(--accent-blue)' }}>
                    ({filteredTeamMembers.length} team members)
                  </span>
                )}
              </span>
              <button className="btn btn-secondary btn-sm"
                onClick={() => setShowManageLeavesModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Settings size={14} />
                Manage
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <p style={{ fontSize: '13px' }}>Loading leaves...</p>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <p style={{ fontSize: '13px' }}>
                {selectedBoard 
                  ? 'No leaves found for team members assigned to this board.'
                  : 'No leaves found'}
              </p>
              {selectedBoard && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Showing leaves for {filteredTeamMembers.length} team members assigned to "{selectedBoard.name}"
                </p>
              )}
            </div>
          ) : (
            <div className="leave-list">
              {filteredLeaves
                .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
                .map(leave => (
                  <div 
                    key={leave.id} 
                    className="leave-item"
                    style={leave.isUnplanned ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid var(--accent-red)' } : {}}
                  >
                    <div>
                      <div className="leave-member" style={{ fontWeight: '500', color: leave.isUnplanned ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                        {leave.memberName || 'Unknown'}
                        {leave.isUnplanned && (
                          <span className="status-badge danger" style={{ marginLeft: '8px', fontSize: '10px' }}>Unplanned</span>
                        )}
                        {leave.isHalfDay && (
                          <span className="status-badge warning" style={{ marginLeft: '8px', fontSize: '10px' }}>
                            ½ Day {leave.halfDayType ? `(${leave.halfDayType === 'first' ? '1st half' : '2nd half'})` : ''}
                          </span>
                        )}
                      </div>
                      <div className="leave-date" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {format(new Date(leave.startDate), 'MMM d')} - {format(new Date(leave.endDate), 'MMM d, yyyy')}
                      </div>
                      {leave.reason && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {leave.reason}
                        </div>
                      )}
                      {leave.leaveType && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Type: {leave.leaveType}
                        </div>
                      )}
                    </div>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => removeLeave(leave.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Holiday Modal */}
      {showHolidayModal && (
        <div className="modal-overlay" onClick={() => setShowHolidayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Holiday</h3>
              <button className="modal-close" onClick={() => setShowHolidayModal(false)}>×</button>
            </div>

            <div className="form-group">
              <label className="form-label">Holiday Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Republic Day"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="input"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowHolidayModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={addHoliday}>
                Add Holiday
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Leave Modal */}
      {showLeaveModal && (
        <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Leave</h3>
              <button className="modal-close" onClick={() => setShowLeaveModal(false)}>×</button>
            </div>

            <div className="form-group">
              <label className="form-label">Team Member</label>
              <select
                className="select"
                style={{ width: '100%' }}
                value={newLeave.accountId}
                onChange={(e) => setNewLeave({ ...newLeave, accountId: e.target.value })}
              >
                <option value="">Select member...</option>
                {teamMembers.map(member => (
                  <option key={member.accountId} value={member.accountId}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={newLeave.startDate}
                  onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={newLeave.endDate}
                  onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reason (Optional)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Vacation, Personal"
                value={newLeave.reason}
                onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={newLeave.isHalfDay}
                  onChange={(e) => setNewLeave({ ...newLeave, isHalfDay: e.target.checked, halfDayType: e.target.checked ? newLeave.halfDayType : '' })}
                  style={{ marginRight: '8px' }}
                />
                Half Day Leave
              </label>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Check this if the leave is for only half a day (4 hours)
              </div>
              {newLeave.isHalfDay && (
                <div style={{ marginTop: '8px' }}>
                  <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>Which half of the day?</label>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                      <input
                        type="radio"
                        name="halfDayType"
                        value="first"
                        checked={newLeave.halfDayType === 'first'}
                        onChange={(e) => setNewLeave({ ...newLeave, halfDayType: e.target.value })}
                        style={{ marginRight: '4px' }}
                      />
                      1st Half
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                      <input
                        type="radio"
                        name="halfDayType"
                        value="second"
                        checked={newLeave.halfDayType === 'second'}
                        onChange={(e) => setNewLeave({ ...newLeave, halfDayType: e.target.value })}
                        style={{ marginRight: '4px' }}
                      />
                      2nd Half
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--accent-red)' }}>
                <input
                  type="checkbox"
                  checked={newLeave.isUnplanned}
                  onChange={(e) => setNewLeave({ ...newLeave, isUnplanned: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Unplanned Leave
              </label>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Check this if the leave was taken after the sprint started (emergency/sick leave)
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLeaveModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={addLeave}>
                Add Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <LeavesModal
        isOpen={showManageLeavesModal}
        onClose={() => setShowManageLeavesModal(false)}
        onLeavesChanged={loadData}
      />
    </>
  );
}

export default HolidaysLeaves;
