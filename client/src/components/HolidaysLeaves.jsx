import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, User } from 'lucide-react';
import { configApi } from '../api';
import { format } from 'date-fns';

function HolidaysLeaves() {
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '' });
  const [newLeave, setNewLeave] = useState({ accountId: '', startDate: '', endDate: '', reason: '', isHalfDay: false, isUnplanned: false });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
      setNewLeave({ accountId: '', startDate: '', endDate: '', reason: '', isHalfDay: false, isUnplanned: false });
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

  return (
    <div className="grid grid-2">
      {/* Holidays Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Calendar size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Holidays
          </h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowHolidayModal(true)}>
            <Plus size={14} />
            Add Holiday
          </button>
        </div>

        {holidays.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <p style={{ fontSize: '13px' }}>No holidays configured</p>
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
        <div className="card-header">
          <h3 className="card-title">
            <User size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Team Leaves
          </h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowLeaveModal(true)}>
            <Plus size={14} />
            Add Leave
          </button>
        </div>

        {leaves.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <p style={{ fontSize: '13px' }}>No leaves recorded</p>
          </div>
        ) : (
          <div className="leave-list">
            {leaves
              .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
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
                        <span className="status-badge warning" style={{ marginLeft: '8px', fontSize: '10px' }}>½ Day</span>
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
                  onChange={(e) => setNewLeave({ ...newLeave, isHalfDay: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Half Day Leave
              </label>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Check this if the leave is for only half a day (4 hours)
              </div>
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
    </div>
  );
}

export default HolidaysLeaves;
