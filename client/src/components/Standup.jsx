import React, { useState, useMemo, useEffect } from 'react';
import { ExternalLink, User } from 'lucide-react';
import UserWorkLogs from './UserWorkLogs';
import { configApi } from '../api';

const getJiraLink = (baseUrl, issueKey) => `${baseUrl}/browse/${issueKey}`;

function Standup({ planningData, sprint, loading, jiraBaseUrl = '' }) {
  const [selectedMember, setSelectedMember] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [leaves, setLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(true);

  // Fetch leave data on component mount
  useEffect(() => {
    const fetchLeaves = async () => {
      try {
        const response = await configApi.getLeaves();
        setLeaves(response.data || []);
      } catch (error) {
        console.error('Error fetching leaves:', error);
      } finally {
        setLeavesLoading(false);
      }
    };
    
    fetchLeaves();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading standup data...</p>
      </div>
    );
  }

  if (!planningData || !sprint || !planningData.planning) {
    return (
      <div className="card">
        <div className="empty-state">
          <p>Select a sprint to view standup board</p>
        </div>
      </div>
    );
  }

  const { planning } = planningData;
  const members = planning?.members || [];

  // Get today's leaves
  const todaysLeaves = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    return leaves.filter(leave => {
      const startDate = leave.startDate;
      const endDate = leave.endDate || leave.startDate;
      return startDate <= today && endDate >= today;
    });
  }, [leaves]);

  // Get all issues grouped by member
  const allIssues = useMemo(() => {
    const issues = [];
    const parentMap = {}; // Store parent info for reference
    
    members.forEach(memberData => {
      const assignedIssues = (memberData?.work?.assignedIssues || []).filter(issue => !issue.isCompletedBeforeSprint);
      assignedIssues.forEach(issue => {
        const issueWithAssignee = {
          ...issue,
          assignee: memberData.member
        };
        issues.push(issueWithAssignee);
        
        // Build parent map for non-subtasks
        if (!issue.isSubtask) {
          parentMap[issue.key] = issueWithAssignee;
        }
      });
    });
    
    return { issues, parentMap };
  }, [members]);

  // Filter to only subtasks and attach parent info
  const subtasksWithParentInfo = useMemo(() => {
    const { issues, parentMap } = allIssues;
    
    // Get only subtasks
    const subtasks = issues.filter(issue => issue.isSubtask);
    
    // Attach parent info to each subtask
    return subtasks.map(subtask => ({
      ...subtask,
      parentInfo: parentMap[subtask.parentKey] || null
    }));
  }, [allIssues]);

  // Filter subtasks by selected member
  const filteredSubtasks = useMemo(() => {
    if (!selectedMember) return subtasksWithParentInfo;
    return subtasksWithParentInfo.filter(subtask => subtask.assignee?.accountId === selectedMember);
  }, [subtasksWithParentInfo, selectedMember]);

  // Toggle collapse state for a parent group
  const toggleGroupCollapse = (parentKey) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentKey)) {
        newSet.delete(parentKey);
      } else {
        newSet.add(parentKey);
      }
      return newSet;
    });
  };

  // Group subtasks by parent and categorize by status into columns
  const parentGroups = useMemo(() => {
    const todoStatuses = ['To Do', 'Open', 'Backlog', 'New', 'Reopened'];
    const inProgressStatuses = ['In Progress', 'In Development', 'Dev - Pre work', 'Dev - Analysis', 
      'Dev - Development', 'Dev - Code Review', 'Dev - QA Support', 'Dev - Changes', 
      'QA - Analysis', 'QA - Testing', 'QA - Clarification', 'IN TESTING', 'ANALYSIS',
      'Code Review', 'Ready for QA', 'In Review', 'Testing'];
    const doneStatuses = ['Done', 'Closed', 'Resolved', 'Deployed Pending Monitoring', 
      'Deployed - Monitoring Completed', 'Enhancement Completed', 'Not a Bug', 'Duplicate', 'Fix Not Needed'];

    const getColumn = (status) => {
      const statusLower = status?.toLowerCase() || '';
      if (doneStatuses.some(s => s.toLowerCase() === statusLower)) return 'done';
      if (inProgressStatuses.some(s => s.toLowerCase() === statusLower)) return 'inProgress';
      if (todoStatuses.some(s => s.toLowerCase() === statusLower)) return 'todo';
      // Default based on keywords
      if (statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('closed')) return 'done';
      if (statusLower.includes('progress') || statusLower.includes('dev') || statusLower.includes('qa') || statusLower.includes('test') || statusLower.includes('review')) return 'inProgress';
      return 'todo';
    };

    // Group subtasks by parent key
    const groupedByParent = {};
    
    filteredSubtasks.forEach(subtask => {
      const parentKey = subtask.parentKey || 'no-parent';
      const column = getColumn(subtask.status);
      
      if (!groupedByParent[parentKey]) {
        groupedByParent[parentKey] = {
          parentInfo: subtask.parentInfo,
          subtasks: { todo: [], inProgress: [], done: [] }
        };
      }
      
      groupedByParent[parentKey].subtasks[column].push(subtask);
    });

    return groupedByParent;
  }, [filteredSubtasks]);

  // Time tracking progress bar component
  const TimeTrackingBar = ({ logged, remaining, estimate }) => {
    const total = logged + remaining;
    const loggedPercent = total > 0 ? (logged / total) * 100 : 0;
    
    const formatTime = (hours) => {
      if (hours === 0) return '0h';
      const days = Math.floor(hours / 8);
      const hrs = Math.round(hours % 8);
      if (days > 0 && hrs > 0) return `${days}d ${hrs}h`;
      if (days > 0) return `${days}d`;
      return `${hrs}h`;
    };

    return (
      <div className="time-tracking">
        <div className="time-tracking-bar">
          <div 
            className="time-tracking-logged" 
            style={{ width: `${Math.min(loggedPercent, 100)}%` }}
          />
        </div>
        <div className="time-tracking-labels">
          <span className="logged">{formatTime(logged)} logged</span>
          <span className="remaining">{formatTime(remaining)} remaining</span>
        </div>
      </div>
    );
  };

  // Issue type badge colors
  const getIssueTypeBadge = (issueType) => {
    const colors = {
      'Story': { bg: 'var(--accent-green)', text: '#fff' },
      'Task': { bg: 'var(--accent-blue)', text: '#fff' },
      'Bug': { bg: 'var(--accent-red)', text: '#fff' },
      'Technical Task': { bg: 'var(--accent-purple)', text: '#fff' },
      'Sub-task': { bg: 'var(--accent-cyan)', text: '#fff' },
      'Production Issue': { bg: 'var(--accent-red)', text: '#fff' }
    };
    return colors[issueType] || { bg: 'var(--accent-orange)', text: '#fff' };
  };

  // Status badge
  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || '';
    let color = 'var(--text-muted)';
    if (statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('deployed')) {
      color = 'var(--accent-green)';
    } else if (statusLower.includes('progress') || statusLower.includes('dev') || statusLower.includes('qa') || statusLower.includes('test')) {
      color = 'var(--accent-blue)';
    }
    return color;
  };

  // Format date helper
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

  // Subtask card component (simplified without parent info)
  const SubtaskCard = ({ subtask }) => {
    const startDate = formatDate(subtask.startDate);
    const dueDate = formatDate(subtask.dueDate);
    
    return (
      <div className="standup-subtask-card">
        <div className="subtask-main">
          <div className="subtask-header">
            <a 
              href={getJiraLink(jiraBaseUrl, subtask.key)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="issue-key"
            >
              {subtask.key}
              <ExternalLink size={10} style={{ marginLeft: 4 }} />
            </a>
            <span 
              className="status-badge"
              style={{ color: getStatusBadge(subtask.status) }}
            >
              {subtask.status}
            </span>
          </div>
          <div className="subtask-summary">{subtask.summary}</div>
          
          {/* Date information - always visible */}
          <div className="date-info">
            <span className="date-item">
              <span className="date-label">Start:</span>
              <span className="date-value">
                {startDate || <span className="no-date">No start date</span>}
              </span>
            </span>
            <span className="date-item">
              <span className="date-label">Due:</span>
              <span className="date-value">
                {dueDate || <span className="no-date">No due date</span>}
              </span>
            </span>
          </div>
          
          <TimeTrackingBar 
            logged={subtask.workLogged || subtask.timeSpent || 0}
            remaining={subtask.remainingEstimate || 0}
            estimate={subtask.originalEstimate || 0}
          />
          {subtask.assignee && (
            <div className="subtask-assignee">
              <User size={12} />
              <span>{subtask.assignee.displayName}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Parent group component - spans across all three columns
  const ParentGroup = ({ parentKey, parentGroup }) => {
    const { parentInfo, subtasks } = parentGroup;
    const isCollapsed = collapsedGroups.has(parentKey);
    const totalSubtasks = Object.values(subtasks).reduce((total, columnSubtasks) => total + columnSubtasks.length, 0);
    
    if (totalSubtasks === 0) return null;
    
    return (
      <div className="parent-group">
        {parentInfo && (
          <div className="parent-header">
            <button 
              className="collapse-toggle"
              onClick={() => toggleGroupCollapse(parentKey)}
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              <span className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`}>
                ▼
              </span>
            </button>
            <span 
              className="parent-type-badge"
              style={{ backgroundColor: getIssueTypeBadge(parentInfo.issueType).bg, color: getIssueTypeBadge(parentInfo.issueType).text }}
            >
              {parentInfo.issueType}
            </span>
            <a 
              href={getJiraLink(jiraBaseUrl, parentInfo.key)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="parent-key"
            >
              {parentInfo.key}
              <ExternalLink size={10} style={{ marginLeft: 3 }} />
            </a>
            <span className="parent-summary">{parentInfo.summary}</span>
            <span className="subtask-count">{totalSubtasks} subtask{totalSubtasks !== 1 ? 's' : ''}</span>
          </div>
        )}
        
        {!isCollapsed && (
          <div className="parent-columns">
            <div className="parent-column">
              <div className="parent-column-header">TO DO ({subtasks.todo.length})</div>
              <div className="subtasks-list">
                {subtasks.todo.map(subtask => (
                  <SubtaskCard key={subtask.key} subtask={subtask} />
                ))}
                {subtasks.todo.length === 0 && (
                  <div className="empty-subtasks">No subtasks</div>
                )}
              </div>
            </div>
            
            <div className="parent-column">
              <div className="parent-column-header">IN PROGRESS ({subtasks.inProgress.length})</div>
              <div className="subtasks-list">
                {subtasks.inProgress.map(subtask => (
                  <SubtaskCard key={subtask.key} subtask={subtask} />
                ))}
                {subtasks.inProgress.length === 0 && (
                  <div className="empty-subtasks">No subtasks</div>
                )}
              </div>
            </div>
            
            <div className="parent-column">
              <div className="parent-column-header">DONE ({subtasks.done.length})</div>
              <div className="subtasks-list">
                {subtasks.done.map(subtask => (
                  <SubtaskCard key={subtask.key} subtask={subtask} />
                ))}
                {subtasks.done.length === 0 && (
                  <div className="empty-subtasks">No subtasks</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Main container for all parent groups
  const ParentGroupsContainer = () => {
    return (
      <div className="parent-groups-container">
        {/* Fixed column headers */}
        <div className="fixed-headers">
          <div className="fixed-header">TO DO</div>
          <div className="fixed-header">IN PROGRESS</div>
          <div className="fixed-header">DONE</div>
        </div>
        
        {/* Scrollable parent groups */}
        <div className="parent-groups-scrollable">
          {Object.entries(parentGroups).map(([parentKey, parentGroup]) => (
            <ParentGroup 
              key={parentKey} 
              parentKey={parentKey}
              parentGroup={parentGroup}
            />
          ))}
          {Object.keys(parentGroups).length === 0 && (
            <div className="empty-state">No subtasks found</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="standup-container">
      <div className="standup-sidebar">
        <h3>Stand-up</h3>
        <div className="member-list">
          <button
            className={`member-item ${selectedMember === null ? 'active' : ''}`}
            onClick={() => setSelectedMember(null)}
          >
            <div className="member-avatar all">All</div>
            <span>All Members</span>
          </button>
          {members.map(memberData => (
            <button
              key={memberData.member.accountId}
              className={`member-item ${selectedMember === memberData.member.accountId ? 'active' : ''}`}
              onClick={() => setSelectedMember(memberData.member.accountId)}
            >
              <div className="member-avatar">
                {memberData.member.displayName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span>{memberData.member.displayName}</span>
            </button>
          ))}
        </div>
        
        {/* Today's Leaves Section */}
        <div className="standup-leaves-section">
          <h4>Today's Leaves</h4>
          {leavesLoading ? (
            <div className="leaves-loading">
              <div className="spinner-small"></div>
              <span>Loading leaves...</span>
            </div>
          ) : todaysLeaves.length > 0 ? (
            <div className="leaves-list">
              {todaysLeaves.map((leave, index) => (
                <div key={leave.id || index} className="leave-item">
                  <div className="leave-member">{leave.memberName}</div>
                  <div className="leave-type">
                    {leave.isHalfDay ? 'Half Day' : 'Full Day'}
                    {leave.isUnplanned && <span className="unplanned-badge">Unplanned</span>}
                  </div>
                  {leave.reason && (
                    <div className="leave-reason">{leave.reason}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-leaves">No leaves today</div>
          )}
        </div>
      </div>
      
      <div className="standup-board">
        <div className="board-header">
          <span className="sprint-info">
            {sprint.name} • Total: {filteredSubtasks.length} subtasks
          </span>
        </div>
        <ParentGroupsContainer />
      </div>
      
      {selectedMember && (
        <div className="standup-worklog-panel">
          <UserWorkLogs 
            accountId={selectedMember}
            displayName={members.find(m => m.member.accountId === selectedMember)?.member?.displayName}
            jiraBaseUrl={jiraBaseUrl}
          />
        </div>
      )}
      
      <style>{`
        .standup-container {
          display: flex;
          gap: 16px;
          height: calc(100vh - 180px);
          min-height: 500px;
        }
        
        .standup-sidebar {
          width: 200px;
          flex-shrink: 0;
          background: var(--bg-secondary);
          border-radius: 8px;
          padding: 16px;
          overflow-y: auto;
        }
        
        .standup-worklog-panel {
          width: 320px;
          flex-shrink: 0;
          overflow-y: auto;
        }
        
        .standup-sidebar h3 {
          margin: 0 0 16px 0;
          font-size: 14px;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .member-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .member-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          color: var(--text-secondary);
          transition: all 0.15s ease;
        }
        
        .member-item:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }
        
        .member-item.active {
          background: var(--accent-blue);
          color: #fff;
        }
        
        .member-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--accent-purple);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          flex-shrink: 0;
        }
        
        .member-avatar.all {
          background: var(--accent-blue);
          font-size: 10px;
        }
        
        .member-item span {
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .standup-leaves-section {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 2px solid var(--border-color);
        }
        
        .standup-leaves-section h4 {
          margin: 0 0 14px 0;
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-orange);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .leaves-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px 8px;
          color: var(--text-muted);
          font-size: 12px;
        }
        
        .leaves-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .leave-item {
          background: linear-gradient(135deg, rgba(255, 152, 0, 0.08), rgba(255, 152, 0, 0.02));
          border-radius: 8px;
          padding: 12px;
          border: 1px solid rgba(255, 152, 0, 0.2);
          font-size: 12px;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .leave-item:hover {
          background: linear-gradient(135deg, rgba(255, 152, 0, 0.12), rgba(255, 152, 0, 0.05));
          border-color: rgba(255, 152, 0, 0.3);
        }
        
        .leave-member {
          font-weight: 700;
          color: var(--text-primary);
          font-size: 13px;
          line-height: 1.4;
        }
        
        .leave-type {
          color: var(--accent-orange);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          line-height: 1.4;
        }
        
        .unplanned-badge {
          background: var(--accent-red);
          color: #fff;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }
        
        .leave-reason {
          color: var(--text-muted);
          font-style: italic;
          font-size: 11px;
          line-height: 1.4;
          word-break: break-word;
        }
        
        .no-leaves {
          text-align: center;
          color: var(--text-muted);
          font-size: 12px;
          padding: 16px 12px;
          background: var(--bg-tertiary);
          border-radius: 6px;
          border: 1px dashed var(--border-color);
        }
        
        .standup-board {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        
        .board-header {
          margin-bottom: 12px;
          padding: 0 4px;
        }
        
        .sprint-info {
          font-size: 13px;
          color: var(--text-muted);
        }
        
        .parent-groups-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }
        
        .fixed-headers {
          display: flex;
          gap: 12px;
          padding: 0 8px 12px 8px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        
        .fixed-header {
          flex: 1;
          font-size: 13px;
          font-weight: 700;
          padding: 10px 16px;
          border-radius: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
          text-align: center;
          border: 2px solid transparent;
          transition: all 0.2s ease;
          position: relative;
        }
        
        .fixed-header:first-child {
          background: linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05));
          color: #ff9800;
          border-color: rgba(255, 152, 0, 0.3);
        }
        
        .fixed-header:nth-child(2) {
          background: linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(33, 150, 243, 0.05));
          color: #2196f3;
          border-color: rgba(33, 150, 243, 0.3);
        }
        
        .fixed-header:nth-child(3) {
          background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05));
          color: #4caf50;
          border-color: rgba(76, 175, 80, 0.3);
        }
        
        .fixed-header:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .fixed-header:first-child:hover {
          box-shadow: 0 4px 12px rgba(255, 152, 0, 0.2);
        }
        
        .fixed-header:nth-child(2):hover {
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.2);
        }
        
        .fixed-header:nth-child(3):hover {
          box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
        }
        
        .parent-groups-scrollable {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 0;
        }
        
        .empty-state {
          text-align: center;
          color: var(--text-muted);
          font-size: 14px;
          padding: 40px;
        }
        
        .standup-parent-card {
          background: var(--bg-primary);
          border-radius: 6px;
          padding: 12px;
          border: 1px solid var(--border-color);
        }
        
        .parent-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        
        .expand-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          color: var(--text-muted);
          display: flex;
          align-items: center;
        }
        
        .expand-btn:hover {
          color: var(--text-primary);
        }
        
        .issue-type-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: 500;
          text-transform: uppercase;
        }
        
        .issue-key {
          font-size: 12px;
          color: var(--accent-blue);
          text-decoration: none;
          display: flex;
          align-items: center;
          font-weight: 500;
        }
        
        .issue-key:hover {
          text-decoration: underline;
        }
        
        .subtask-count {
          font-size: 11px;
          color: var(--text-muted);
        }
        
        .parent-summary {
          font-size: 13px;
          color: var(--text-primary);
          margin-bottom: 8px;
          line-height: 1.4;
        }
        
        .parent-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        
        .status-badge {
          font-size: 11px;
          font-weight: 500;
        }
        
        .assignee {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-muted);
        }
        
        .subtasks-container {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .standup-subtask-card {
          background: var(--bg-primary);
          border-radius: 6px;
          padding: 12px;
          border: 1px solid var(--border-color);
        }
        
        .subtask-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        
        .subtask-summary {
          font-size: 13px;
          color: var(--text-primary);
          margin-bottom: 10px;
          line-height: 1.4;
        }
        
        .date-info {
          display: flex;
          gap: 12px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        
        .date-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
        }
        
        .date-label {
          color: var(--text-muted);
          font-weight: 500;
        }
        
        .date-value {
          color: var(--text-secondary);
          font-weight: 400;
        }
        
        .date-value .no-date {
          color: #ef4444;
          font-style: italic;
          opacity: 0.8;
        }
        
        .subtask-assignee {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 8px;
        }
        
        .time-tracking {
          margin-top: 8px;
        }
        
        .time-tracking-bar {
          height: 6px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          overflow: hidden;
        }
        
        .time-tracking-logged {
          height: 100%;
          background: var(--accent-blue);
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        
        .time-tracking-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          font-size: 10px;
        }
        
        .time-tracking-labels .logged {
          color: var(--accent-blue);
        }
        
        .time-tracking-labels .remaining {
          color: var(--text-muted);
        }
        
        .parent-group {
          background: var(--bg-secondary);
          border-radius: 8px;
          overflow: visible; /* Changed from hidden to visible */
          border: 1px solid var(--border-color);
        }
        
        .parent-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
        }
        
        .collapse-toggle {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 3px;
          transition: all 0.2s ease;
        }
        
        .collapse-toggle:hover {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }
        
        .collapse-icon {
          font-size: 12px;
          transition: transform 0.2s ease;
        }
        
        .collapse-icon.collapsed {
          transform: rotate(-90deg);
        }
        
        .parent-header .parent-type-badge {
          font-size: 9px;
          padding: 2px 5px;
          border-radius: 3px;
          font-weight: 500;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        
        .parent-header .parent-key {
          font-size: 11px;
          color: var(--accent-blue);
          text-decoration: none;
          display: flex;
          align-items: center;
          font-weight: 500;
          flex-shrink: 0;
        }
        
        .parent-header .parent-key:hover {
          text-decoration: underline;
        }
        
        .parent-summary {
          font-size: 12px;
          color: var(--text-primary);
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .subtask-count {
          font-size: 10px;
          color: var(--text-muted);
          background: var(--bg-secondary);
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 500;
          flex-shrink: 0;
        }
        
        .parent-columns {
          display: flex;
          gap: 12px;
          padding: 0;
        }
        
        .parent-column {
          flex: 1;
          min-width: 0;
        }
        
        .parent-column-header {
          display: none; /* Hide individual column headers since we have fixed ones */
        }
        
        .subtasks-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px;
        }
        
        .empty-subtasks {
          text-align: center;
          color: var(--text-muted);
          font-size: 12px;
          padding: 16px;
          background: var(--bg-primary);
          border-radius: 4px;
          border: 1px dashed var(--border-color);
        }
      `}</style>
    </div>
  );
}

export default Standup;
