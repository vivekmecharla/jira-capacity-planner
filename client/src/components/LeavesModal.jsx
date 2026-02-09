import React, { useState, useEffect } from 'react';
import { configApi } from '../api';

const formatDate = (dateString) => {
  if (!dateString) return null;
  try {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return null;
  }
};

const LeaveForm = ({ leave, onSave, onCancel, teamMembers }) => {
  const [formData, setFormData] = useState({
    memberName: leave?.memberName || '',
    startDate: leave?.startDate || new Date().toISOString().split('T')[0],
    endDate: leave?.endDate || new Date().toISOString().split('T')[0],
    isHalfDay: leave?.isHalfDay || false,
    halfDayType: leave?.halfDayType || '',
    isUnplanned: leave?.isUnplanned || false,
    reason: leave?.reason || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Team Member
        </label>
        <select
          value={formData.memberName}
          onChange={(e) => setFormData({ ...formData, memberName: e.target.value })}
          required
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '12px'
          }}
        >
          <option value="">Select team member</option>
          {teamMembers.map(member => (
            <option key={member.accountId} value={member.displayName}>
              {member.displayName}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Start Date
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px'
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            End Date
          </label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={formData.isHalfDay}
            onChange={(e) => setFormData({ ...formData, isHalfDay: e.target.checked, halfDayType: e.target.checked ? formData.halfDayType : '' })}
            style={{ margin: 0 }}
          />
          Half Day
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={formData.isUnplanned}
            onChange={(e) => setFormData({ ...formData, isUnplanned: e.target.checked })}
            style={{ margin: 0 }}
          />
          Unplanned
        </label>
      </div>

      {formData.isHalfDay && (
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Which half of the day?
          </label>
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="radio"
                name="halfDayType"
                value="first"
                checked={formData.halfDayType === 'first'}
                onChange={(e) => setFormData({ ...formData, halfDayType: e.target.value })}
                style={{ margin: 0 }}
              />
              1st Half
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="radio"
                name="halfDayType"
                value="second"
                checked={formData.halfDayType === 'second'}
                onChange={(e) => setFormData({ ...formData, halfDayType: e.target.value })}
                style={{ margin: 0 }}
              />
              2nd Half
            </label>
          </div>
        </div>
      )}

      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Reason (Optional)
        </label>
        <input
          type="text"
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="e.g., Medical, Personal, Vacation"
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '12px'
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '6px 12px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            padding: '6px 12px',
            border: 'none',
            borderRadius: '4px',
            background: 'var(--accent-blue)',
            color: '#fff',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          {leave ? 'Update' : 'Add'} Leave
        </button>
      </div>
    </form>
  );
};

function LeavesModal({ isOpen, onClose, onLeavesChanged }) {
  const [allLeaves, setAllLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchAllLeaves();
      fetchTeamMembers();
    }
  }, [isOpen]);

  const fetchAllLeaves = async () => {
    setLoading(true);
    try {
      const response = await configApi.getLeaves();
      setAllLeaves(response.data || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const response = await configApi.getTeam();
      setTeamMembers(response.data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const handleSaveLeave = async (leaveData) => {
    try {
      if (editingLeave) {
        await configApi.updateLeave(editingLeave.id, leaveData);
      } else {
        await configApi.addLeave(leaveData);
      }
      await fetchAllLeaves();
      setEditingLeave(null);
      if (onLeavesChanged) {
        onLeavesChanged();
      }
    } catch (error) {
      console.error('Error saving leave:', error);
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    if (window.confirm('Are you sure you want to delete this leave?')) {
      try {
        await configApi.removeLeave(leaveId);
        await fetchAllLeaves();
        if (onLeavesChanged) {
          onLeavesChanged();
        }
      } catch (error) {
        console.error('Error deleting leave:', error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={onClose}
      >
        {/* Modal */}
        <div
          style={{
            background: 'var(--bg-primary)',
            borderRadius: '8px',
            padding: '20px',
            width: '600px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid var(--border-color)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>
              Manage Leaves
            </h3>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: 'var(--text-muted)',
                padding: '4px'
              }}
            >
              ×
            </button>
          </div>

          {/* Add New Leave Button */}
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => setEditingLeave(false)}
              style={{
                padding: '8px 16px',
                background: 'var(--accent-blue)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              + Add New Leave
            </button>
          </div>

          {/* Leave Form */}
          {editingLeave !== null && editingLeave !== undefined && (
            <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
                {editingLeave ? 'Edit Leave' : 'Add New Leave'}
              </h4>
              <LeaveForm
                leave={editingLeave || null}
                onSave={handleSaveLeave}
                onCancel={() => setEditingLeave(null)}
                teamMembers={teamMembers}
              />
            </div>
          )}

          {/* Leaves List */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
              All Leaves
            </h4>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                Loading leaves...
              </div>
            ) : allLeaves.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                No leaves found
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflow: 'auto' }}>
                {allLeaves
                  .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
                  .map((leave) => (
                  <div
                    key={leave.id}
                    style={{
                      padding: '12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>
                        {leave.memberName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                        {leave.isHalfDay && ` (½ Day${leave.halfDayType ? ` ${leave.halfDayType === 'first' ? '1st half' : '2nd half'}` : ''})`}
                        {leave.isUnplanned && ' - Unplanned'}
                      </div>
                      {leave.reason && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {leave.reason}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => setEditingLeave(leave)}
                        style={{
                          padding: '4px 8px',
                          background: 'var(--accent-blue)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '10px'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteLeave(leave.id)}
                        style={{
                          padding: '4px 8px',
                          background: 'var(--accent-red)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '10px'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default LeavesModal;
