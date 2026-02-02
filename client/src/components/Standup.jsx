import React, { useState, useMemo } from 'react';
import { ExternalLink, User } from 'lucide-react';

const getJiraLink = (baseUrl, issueKey) => `${baseUrl}/browse/${issueKey}`;

function Standup({ planningData, sprint, loading, jiraBaseUrl = '' }) {
  const [selectedMember, setSelectedMember] = useState(null);

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

  // Get all issues grouped by member
  const allIssues = useMemo(() => {
    const issues = [];
    const parentMap = {}; // Store parent info for reference
    
    members.forEach(memberData => {
      const assignedIssues = memberData?.work?.assignedIssues || [];
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

  // Categorize subtasks by status into columns
  const columns = useMemo(() => {
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

    const todo = [];
    const inProgress = [];
    const done = [];

    filteredSubtasks.forEach(subtask => {
      const column = getColumn(subtask.status);
      if (column === 'todo') todo.push(subtask);
      else if (column === 'inProgress') inProgress.push(subtask);
      else done.push(subtask);
    });

    return { todo, inProgress, done };
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

  // Subtask card component (primary card showing subtask with parent info)
  const SubtaskCard = ({ subtask }) => {
    const parentInfo = subtask.parentInfo;
    const parentTypeBadge = parentInfo ? getIssueTypeBadge(parentInfo.issueType) : null;
    
    return (
      <div className="standup-subtask-card">
        {/* Parent info section */}
        {parentInfo && (
          <div className="parent-info-section">
            <span 
              className="parent-type-badge"
              style={{ backgroundColor: parentTypeBadge?.bg, color: parentTypeBadge?.text }}
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
            <span className="parent-summary-text">{parentInfo.summary}</span>
          </div>
        )}
        
        {/* Subtask main content */}
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

  // Column component - now renders subtasks directly
  const Column = ({ title, subtasks, count }) => (
    <div className="standup-column">
      <div className="column-header">
        <h3>{title}</h3>
        <span className="count">{count}</span>
      </div>
      <div className="column-content">
        {subtasks.map(subtask => (
          <SubtaskCard key={subtask.key} subtask={subtask} />
        ))}
        {subtasks.length === 0 && (
          <div className="empty-column">No items</div>
        )}
      </div>
    </div>
  );

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
      </div>
      
      <div className="standup-board">
        <div className="board-header">
          <span className="sprint-info">
            {sprint.name} • Total: {filteredSubtasks.length} subtasks
          </span>
        </div>
        <div className="board-columns">
          <Column title="TO DO" subtasks={columns.todo} count={columns.todo.length} />
          <Column title="IN PROGRESS" subtasks={columns.inProgress} count={columns.inProgress.length} />
          <Column title="DONE" subtasks={columns.done} count={columns.done.length} />
        </div>
      </div>
      
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
        
        .board-columns {
          display: flex;
          gap: 12px;
          flex: 1;
          min-height: 0;
        }
        
        .standup-column {
          flex: 1;
          background: var(--bg-secondary);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          min-width: 280px;
        }
        
        .column-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .column-header h3 {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.5px;
        }
        
        .column-header .count {
          background: var(--bg-tertiary);
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          color: var(--text-secondary);
        }
        
        .column-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .empty-column {
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
          padding: 20px;
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
        
        .parent-info-section {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        
        .parent-type-badge {
          font-size: 9px;
          padding: 2px 5px;
          border-radius: 3px;
          font-weight: 500;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        
        .parent-key {
          font-size: 11px;
          color: var(--accent-blue);
          text-decoration: none;
          display: flex;
          align-items: center;
          font-weight: 500;
          flex-shrink: 0;
        }
        
        .parent-key:hover {
          text-decoration: underline;
        }
        
        .parent-summary-text {
          font-size: 11px;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
        }
        
        .subtask-main {
          padding-left: 0;
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
      `}</style>
    </div>
  );
}

export default Standup;
