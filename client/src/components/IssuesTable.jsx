import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ExternalLink, Filter, X, Maximize2, Minimize2 } from 'lucide-react';
import { format } from 'date-fns';

const getJiraLink = (baseUrl, issueKey) => `${baseUrl}/browse/${issueKey}`;

function IssuesTable({ 
  title, 
  issues, 
  subtasksByParent, 
  type = 'techStories', // 'techStories' or 'productionIssues'
  hoursPerDay = 8,
  showStoryPoints = false,
  showDueDate = false,
  showDelay = false,
  getAssigneeName = null, // function to get assignee name (for Sprint Planning which uses members array)
  jiraBaseUrl = ''
}) {
  const [expandedStories, setExpandedStories] = useState({});
  const [sort, setSort] = useState({ column: null, direction: 'asc' });
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);

  const toggleStoryExpand = (key) => {
    setExpandedStories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAllStories = () => {
    const allExpanded = {};
    issues.forEach(issue => {
      const childSubtasks = subtasksByParent[issue.key] || [];
      if (childSubtasks.length > 0) {
        allExpanded[issue.key] = true;
      }
    });
    setExpandedStories(allExpanded);
  };

  const collapseAllStories = () => {
    setExpandedStories({});
  };

  const formatHours = (hours) => {
    if (!hours && hours !== 0) return '-';
    return `${Math.round(hours * 10) / 10}h`;
  };

  const formatEstimate = (hours) => {
    if (!hours || hours === 0) return '-';
    return (
      <div>
        <span style={{ fontWeight: '600' }}>{(hours / hoursPerDay).toFixed(1)}d</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '2px' }}>({formatHours(hours)})</span>
      </div>
    );
  };

  const formatEstimateSmall = (hours) => {
    if (!hours || hours === 0) return '-';
    return (
      <div>
        <span style={{ fontWeight: '600' }}>{(hours / hoursPerDay).toFixed(1)}d</span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '2px' }}>({formatHours(hours)})</span>
      </div>
    );
  };

  // Sort helper
  const handleSort = (column) => {
    if (sort.column === column) {
      setSort({ column, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ column, direction: 'asc' });
    }
  };

  const sortData = (data) => {
    if (!sort.column) return data;
    return [...data].sort((a, b) => {
      let aVal, bVal;
      switch(sort.column) {
        case 'key': aVal = a.key; bVal = b.key; break;
        case 'summary': aVal = a.summary; bVal = b.summary; break;
        case 'status': aVal = a.status; bVal = b.status; break;
        case 'priority': aVal = a.priority || ''; bVal = b.priority || ''; break;
        case 'assignee': 
          aVal = getAssigneeName ? getAssigneeName(a) : (a.assignee || ''); 
          bVal = getAssigneeName ? getAssigneeName(b) : (b.assignee || ''); 
          break;
        case 'devEstimate': aVal = a.devEstimate || 0; bVal = b.devEstimate || 0; break;
        case 'qaEstimate': aVal = a.qaEstimate || 0; bVal = b.qaEstimate || 0; break;
        case 'totalEstimate': aVal = a.originalEstimate || 0; bVal = b.originalEstimate || 0; break;
        case 'workLogged': aVal = a.workLogged || 0; bVal = b.workLogged || 0; break;
        case 'storyPoints': aVal = a.storyPoints || 0; bVal = b.storyPoints || 0; break;
        case 'dueDate': aVal = a.dueDate ? new Date(a.dueDate).getTime() : 0; bVal = b.dueDate ? new Date(b.dueDate).getTime() : 0; break;
        default: aVal = a[sort.column]; bVal = b[sort.column];
      }
      if (aVal === null || aVal === undefined) return sort.direction === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sort.direction === 'asc' ? -1 : 1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sort.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  };

  // Update column filter
  const updateColumnFilter = (column, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setColumnFilters({});
    setActiveFilterColumn(null);
  };

  // Check if any filters are active
  const hasActiveFilters = Object.values(columnFilters).some(v => v && v.trim() !== '');

  // Filter issues by column filters
  const filteredIssues = issues.filter(issue => {
    for (const [column, filterValue] of Object.entries(columnFilters)) {
      if (!filterValue || filterValue.trim() === '') continue;
      
      const lowerFilter = filterValue.toLowerCase();
      let value = '';
      
      switch (column) {
        case 'key':
          value = issue.key || '';
          break;
        case 'summary':
          value = issue.summary || '';
          break;
        case 'status':
          value = issue.status || '';
          break;
        case 'priority':
          value = issue.priority || '';
          break;
        case 'assignee':
          value = getAssigneeName ? getAssigneeName(issue) : (issue.assignee || '');
          break;
        default:
          value = String(issue[column] || '');
      }
      
      if (!value.toLowerCase().includes(lowerFilter)) {
        return false;
      }
    }
    return true;
  });

  const sortedIssues = sortData(filteredIssues);

  // Sortable header component with column filter
  const SortHeader = ({ label, column, className = '', filterable = true, tooltip = '' }) => {
    const hasFilter = columnFilters[column] && columnFilters[column].trim() !== '';
    
    return (
      <th className={className} style={{ position: 'relative', minWidth: '80px' }} title={tooltip}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: className.includes('text-center') ? 'center' : 'flex-start', 
              gap: '4px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onClick={() => handleSort(column)}
          >
            {label}
            {sort.column === column && (
              sort.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
            )}
            {filterable && (
              <Filter 
                size={10} 
                style={{ 
                  color: hasFilter ? 'var(--accent-blue)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFilterColumn(activeFilterColumn === column ? null : column);
                }}
              />
            )}
          </div>
          {filterable && activeFilterColumn === column && (
            <input
              type="text"
              placeholder={`Filter ${label}...`}
              value={columnFilters[column] || ''}
              onChange={(e) => updateColumnFilter(column, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                width: '100%'
              }}
              autoFocus
            />
          )}
        </div>
      </th>
    );
  };

  // Get row style based on carryover and late addition status
  // Late takes priority over Carryover (mutually exclusive)
  const getRowStyle = (issue, hasSubtasks) => {
    const baseStyle = { cursor: hasSubtasks ? 'pointer' : 'default' };
    
    // Late addition takes priority (yellow)
    if (issue.isLateAddition) {
      return { 
        ...baseStyle, 
        backgroundColor: 'rgba(255, 193, 7, 0.15)',
        borderLeft: '3px solid var(--accent-yellow)'
      };
    }
    
    // Carryover (orange) - only if not late
    if (issue.isCarryover) {
      return { 
        ...baseStyle, 
        backgroundColor: 'rgba(249, 115, 22, 0.1)', 
        borderLeft: '3px solid var(--accent-orange)' 
      };
    }
    
    return baseStyle;
  };

  const getDelayReason = (issue) => {
    if (!issue.dueDate) return null;
    const dueDate = new Date(issue.dueDate);
    const now = new Date();
    if (!issue.isCompleted && dueDate < now) {
      const daysOverdue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));
      return `${daysOverdue}d overdue`;
    }
    return null;
  };

  if (issues.length === 0) return null;

  const isProdIssues = type === 'productionIssues';

  return (
    <div className="card mt-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>
          {title} ({issues.length}){hasActiveFilters && ` - showing ${sortedIssues.length}`}
        </h3>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
          {issues.some(issue => (subtasksByParent[issue.key] || []).length > 0) && (
            <>
              <button
                onClick={expandAllStories}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Expand all stories"
              >
                <Maximize2 size={14} />
                Expand All
              </button>
              <button
                onClick={collapseAllStories}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Collapse all stories"
              >
                <Minimize2 size={14} />
                Collapse All
              </button>
            </>
          )}
          {hasActiveFilters && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={clearAllFilters}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
            >
              <X size={12} />
              Clear Filters
            </button>
          )}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="planning-table">
          <thead>
            <tr>
              <SortHeader label="Key" column="key" tooltip="Jira issue key" />
              <SortHeader label="Summary" column="summary" tooltip="Issue title/description" />
              {isProdIssues ? (
                <SortHeader label="Priority" column="priority" className="text-center" tooltip="Issue priority level" />
              ) : (
                <th className="text-center" title="Parent story for subtasks">Parent</th>
              )}
              <SortHeader label="Status" column="status" className="text-center" tooltip="Current workflow status" />
              <SortHeader label="Assignee" column="assignee" className="text-center" tooltip="Team member assigned to this issue" />
              <SortHeader label="Dev Est." column="devEstimate" className="text-center" tooltip="Development estimate from Dev subtasks" />
              <SortHeader label="QA Est." column="qaEstimate" className="text-center" tooltip="QA/Testing estimate from QA subtasks" />
              <SortHeader label="Total Est." column="totalEstimate" className="text-center" tooltip="Total original estimate (Dev + QA)" />
              <SortHeader label="Work Logged" column="workLogged" className="text-center" tooltip="Time logged during this sprint" />
              {showStoryPoints && <SortHeader label="Story Points" column="storyPoints" className="text-center" tooltip="Story point estimate for sizing" />}
              {showDueDate && <SortHeader label="Due Date" column="dueDate" className="text-center" tooltip="Target completion date" />}
              {showDelay && <th className="text-center" title="Days overdue past due date">Delay</th>}
            </tr>
          </thead>
          <tbody>
            {sortedIssues.map(issue => {
              const childSubtasks = subtasksByParent[issue.key] || [];
              const hasSubtasks = childSubtasks.length > 0;
              const isExpanded = expandedStories[issue.key];
              const totalEst = (issue.devEstimate || 0) + (issue.qaEstimate || 0) || issue.originalEstimate;
              // Calculate work logged from subtasks if parent has subtasks, otherwise use issue's workLogged
              const workLoggedFromSubtasks = hasSubtasks 
                ? childSubtasks.reduce((sum, st) => sum + (st.workLogged || 0), 0)
                : 0;
              const effectiveWorkLogged = hasSubtasks ? workLoggedFromSubtasks : (issue.workLogged || 0);
              const delayReason = showDelay ? getDelayReason(issue) : null;
              const assigneeName = getAssigneeName ? getAssigneeName(issue) : issue.assignee;

              return (
                <React.Fragment key={issue.key}>
                  <tr 
                    style={getRowStyle(issue, hasSubtasks)}
                    onClick={() => hasSubtasks && toggleStoryExpand(issue.key)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {hasSubtasks && (
                          isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        )}
                        <a href={getJiraLink(jiraBaseUrl, issue.key)} target="_blank" rel="noopener noreferrer" className="issue-key" style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
                          {issue.key} <ExternalLink size={10} />
                        </a>
                        {issue.isLateAddition ? (
                          <span className="status-badge" style={{ fontSize: '10px', backgroundColor: 'var(--accent-yellow)', color: '#000' }}>Late</span>
                        ) : issue.isCarryover ? (
                          <span className="status-badge warning" style={{ fontSize: '10px' }}>Carryover</span>
                        ) : null}
                        {hasSubtasks && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            ({childSubtasks.length} subtasks)
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <a href={getJiraLink(jiraBaseUrl, issue.key)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }} onClick={(e) => e.stopPropagation()}>
                        {issue.summary}
                      </a>
                    </td>
                    {isProdIssues ? (
                      <td className="text-center">
                        <span className={`status-badge ${issue.priority === 'Highest' || issue.priority === 'High' ? 'danger' : 'info'}`}>
                          {issue.priority || '-'}
                        </span>
                      </td>
                    ) : (
                      <td className="text-center">
                        {issue.parentKey ? (
                          <a href={getJiraLink(jiraBaseUrl, issue.parentKey)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
                            {issue.parentKey}
                          </a>
                        ) : '-'}
                      </td>
                    )}
                    <td className="text-center">
                      <span className={`status-badge ${issue.isCompleted ? 'success' : 'info'}`}>{issue.status}</span>
                    </td>
                    <td className="text-center">{assigneeName || '-'}</td>
                    <td className="text-center" style={{ color: 'var(--accent-blue)' }}>
                      {formatEstimate(issue.devEstimate)}
                    </td>
                    <td className="text-center" style={{ color: 'var(--accent-green)' }}>
                      {formatEstimate(issue.qaEstimate)}
                    </td>
                    <td className="text-center" style={{ fontWeight: '600' }}>
                      {formatEstimate(totalEst)}
                    </td>
                    <td className="text-center" style={{ color: 'var(--accent-purple)' }}>
                      {formatEstimate(effectiveWorkLogged)}
                    </td>
                    {showStoryPoints && <td className="text-center">{issue.storyPoints || '-'}</td>}
                    {showDueDate && (
                      <td className="text-center">
                        {issue.dueDate ? format(new Date(issue.dueDate), 'MMM d') : '-'}
                      </td>
                    )}
                    {showDelay && (
                      <td className="text-center">
                        {delayReason && <span className="status-badge danger">{delayReason}</span>}
                      </td>
                    )}
                  </tr>
                  {isExpanded && childSubtasks.map(st => {
                    const stAssigneeName = getAssigneeName ? getAssigneeName(st) : st.assignee;
                    return (
                      <tr key={st.key} style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <td style={{ paddingLeft: '32px' }}>
                          <a href={getJiraLink(jiraBaseUrl, st.key)} target="_blank" rel="noopener noreferrer" className="issue-key" style={{ fontSize: '11px', textDecoration: 'none' }}>
                            {st.key} <ExternalLink size={9} />
                          </a>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <a href={getJiraLink(jiraBaseUrl, st.key)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                            {st.summary}
                          </a>
                        </td>
                        <td className="text-center">-</td>
                        <td className="text-center">
                          <span className={`status-badge ${st.isCompleted ? 'success' : 'info'}`} style={{ fontSize: '10px' }}>{st.status}</span>
                        </td>
                        <td className="text-center" style={{ fontSize: '12px' }}>{stAssigneeName || '-'}</td>
                        <td className="text-center" style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>
                          {formatEstimateSmall(st.devEstimate)}
                        </td>
                        <td className="text-center" style={{ fontSize: '11px', color: 'var(--accent-green)' }}>
                          {formatEstimateSmall(st.qaEstimate)}
                        </td>
                        <td className="text-center" style={{ fontSize: '11px' }}>
                          {formatEstimateSmall(st.originalEstimate)}
                        </td>
                        <td className="text-center" style={{ fontSize: '11px', color: 'var(--accent-purple)' }}>
                          {formatEstimateSmall(st.workLogged)}
                        </td>
                        {showStoryPoints && <td className="text-center">-</td>}
                        {showDueDate && (
                          <td className="text-center" style={{ fontSize: '12px' }}>
                            {st.dueDate ? format(new Date(st.dueDate), 'MMM d') : '-'}
                          </td>
                        )}
                        {showDelay && <td className="text-center">-</td>}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default IssuesTable;
