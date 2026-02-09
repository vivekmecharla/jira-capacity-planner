import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ExternalLink, Filter, X, Maximize2, Minimize2 } from 'lucide-react';
import { format } from 'date-fns';

const getJiraLink = (baseUrl, issueKey) => `${baseUrl}/browse/${issueKey}`;

function MemberIssuesTable({
  title,
  issues,
  subtasksByParent,
  hoursPerDay = 8,
  showDueDate = false,
  showDelay = false,
  jiraBaseUrl = ''
}) {
  const [expandedMembers, setExpandedMembers] = useState({});
  const [expandedParents, setExpandedParents] = useState({});
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [sort, setSort] = useState({ column: null, direction: 'asc' });

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

  const getRowStyle = (issue) => {
    if (issue.isLateAddition) {
      return {
        backgroundColor: 'rgba(255, 193, 7, 0.15)',
        borderLeft: '3px solid var(--accent-yellow)'
      };
    }
    if (issue.isCarryover) {
      return {
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderLeft: '3px solid var(--accent-orange)'
      };
    }
    return {};
  };

  // Build member-grouped data structure
  // Structure: { memberName: { parentKey: { parent: parentIssue, subtasks: [...] } } }
  const buildMemberGroupedData = () => {
    const memberMap = {};

    // Collect all subtasks from all parent issues
    issues.forEach(parentIssue => {
      const childSubtasks = subtasksByParent[parentIssue.key] || [];

      if (childSubtasks.length > 0) {
        childSubtasks.forEach(subtask => {
          const memberName = subtask.assignee || 'Unassigned';
          if (!memberMap[memberName]) {
            memberMap[memberName] = {};
          }
          if (!memberMap[memberName][parentIssue.key]) {
            memberMap[memberName][parentIssue.key] = {
              parent: parentIssue,
              subtasks: []
            };
          }
          memberMap[memberName][parentIssue.key].subtasks.push(subtask);
        });
      } else {
        // Parent issue with no subtasks — group by its own assignee
        const memberName = parentIssue.assignee || 'Unassigned';
        if (!memberMap[memberName]) {
          memberMap[memberName] = {};
        }
        if (!memberMap[memberName][parentIssue.key]) {
          memberMap[memberName][parentIssue.key] = {
            parent: parentIssue,
            subtasks: []
          };
        }
      }
    });

    return memberMap;
  };

  const memberGroupedData = buildMemberGroupedData();
  const memberNames = Object.keys(memberGroupedData).sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  // Calculate member totals
  const getMemberTotals = (memberName) => {
    const parents = memberGroupedData[memberName];
    let devEst = 0, qaEst = 0, totalEst = 0, workLogged = 0, subtaskCount = 0;

    Object.values(parents).forEach(({ parent, subtasks }) => {
      if (subtasks.length > 0) {
        subtasks.forEach(st => {
          devEst += st.devEstimate || 0;
          qaEst += st.qaEstimate || 0;
          totalEst += st.originalEstimate || 0;
          workLogged += st.workLogged || 0;
          subtaskCount++;
        });
      } else {
        devEst += parent.devEstimate || 0;
        qaEst += parent.qaEstimate || 0;
        totalEst += parent.originalEstimate || 0;
        workLogged += parent.workLogged || 0;
        subtaskCount++;
      }
    });

    return { devEst, qaEst, totalEst, workLogged, subtaskCount, parentCount: Object.keys(parents).length };
  };

  const toggleMember = (memberName) => {
    setExpandedMembers(prev => ({ ...prev, [memberName]: !prev[memberName] }));
  };

  const toggleParent = (memberName, parentKey) => {
    const key = `${memberName}::${parentKey}`;
    setExpandedParents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const allMembers = {};
    const allParents = {};
    memberNames.forEach(name => {
      allMembers[name] = true;
      Object.keys(memberGroupedData[name]).forEach(parentKey => {
        allParents[`${name}::${parentKey}`] = true;
      });
    });
    setExpandedMembers(allMembers);
    setExpandedParents(allParents);
  };

  const collapseAll = () => {
    setExpandedMembers({});
    setExpandedParents({});
  };

  if (issues.length === 0) return null;

  return (
    <div className="card mt-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>
          {title} ({memberNames.length} members)
        </h3>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={expandAll}
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Expand all"
          >
            <Maximize2 size={14} />
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Collapse all"
          >
            <Minimize2 size={14} />
            Collapse All
          </button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="planning-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Summary</th>
              <th className="text-center">Parent</th>
              <th className="text-center">Status</th>
              <th className="text-center">Dev Est.</th>
              <th className="text-center">QA Est.</th>
              <th className="text-center">Total Est.</th>
              <th className="text-center">Work Logged</th>
              {showDueDate && <th className="text-center">Due Date</th>}
              {showDelay && <th className="text-center">Delay</th>}
            </tr>
          </thead>
          <tbody>
            {memberNames.map(memberName => {
              const isMemberExpanded = expandedMembers[memberName];
              const totals = getMemberTotals(memberName);
              const parents = memberGroupedData[memberName];
              const parentKeys = Object.keys(parents);

              return (
                <React.Fragment key={memberName}>
                  {/* Member Header Row */}
                  <tr
                    style={{
                      cursor: 'pointer',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      borderLeft: '3px solid var(--accent-blue)'
                    }}
                    onClick={() => toggleMember(memberName)}
                  >
                    <td colSpan={2}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isMemberExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                          {memberName}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ({totals.subtaskCount} tasks across {totals.parentCount} stories)
                        </span>
                      </div>
                    </td>
                    <td className="text-center">-</td>
                    <td className="text-center">-</td>
                    <td className="text-center" style={{ color: 'var(--accent-blue)', fontWeight: '600' }}>
                      {formatEstimate(totals.devEst)}
                    </td>
                    <td className="text-center" style={{ color: 'var(--accent-green)', fontWeight: '600' }}>
                      {formatEstimate(totals.qaEst)}
                    </td>
                    <td className="text-center" style={{ fontWeight: '700' }}>
                      {formatEstimate(totals.totalEst)}
                    </td>
                    <td className="text-center" style={{ color: 'var(--accent-purple)', fontWeight: '600' }}>
                      {formatEstimate(totals.workLogged)}
                    </td>
                    {showDueDate && <td className="text-center">-</td>}
                    {showDelay && <td className="text-center">-</td>}
                  </tr>

                  {/* Expanded: Parent groups and their subtasks */}
                  {isMemberExpanded && parentKeys.map(parentKey => {
                    const { parent, subtasks } = parents[parentKey];
                    const parentExpandKey = `${memberName}::${parentKey}`;
                    const isParentExpanded = expandedParents[parentExpandKey];
                    const hasSubtasks = subtasks.length > 0;

                    // Calculate parent-level totals from subtasks belonging to this member
                    let parentDevEst = 0, parentQaEst = 0, parentTotalEst = 0, parentWorkLogged = 0;
                    if (hasSubtasks) {
                      subtasks.forEach(st => {
                        parentDevEst += st.devEstimate || 0;
                        parentQaEst += st.qaEstimate || 0;
                        parentTotalEst += st.originalEstimate || 0;
                        parentWorkLogged += st.workLogged || 0;
                      });
                    } else {
                      parentDevEst = parent.devEstimate || 0;
                      parentQaEst = parent.qaEstimate || 0;
                      parentTotalEst = parent.originalEstimate || 0;
                      parentWorkLogged = parent.workLogged || 0;
                    }

                    return (
                      <React.Fragment key={parentExpandKey}>
                        {/* Parent Issue Row */}
                        <tr
                          style={{
                            cursor: hasSubtasks ? 'pointer' : 'default',
                            backgroundColor: 'rgba(139, 92, 246, 0.05)',
                            ...getRowStyle(parent)
                          }}
                          onClick={() => hasSubtasks && toggleParent(memberName, parentKey)}
                        >
                          <td style={{ paddingLeft: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {hasSubtasks && (
                                isParentExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                              )}
                              <a href={getJiraLink(jiraBaseUrl, parent.key)} target="_blank" rel="noopener noreferrer" className="issue-key" style={{ textDecoration: 'none', fontSize: '12px' }} onClick={(e) => e.stopPropagation()}>
                                {parent.key} <ExternalLink size={10} />
                              </a>
                              {parent.isLateAddition ? (
                                <span className="status-badge" style={{ fontSize: '10px', backgroundColor: 'var(--accent-yellow)', color: '#000' }}>Late</span>
                              ) : parent.isCarryover ? (
                                <span className="status-badge warning" style={{ fontSize: '10px' }}>Carryover</span>
                              ) : null}
                              {hasSubtasks && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  ({subtasks.length} subtasks)
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <a href={getJiraLink(jiraBaseUrl, parent.key)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', fontSize: '12px' }} onClick={(e) => e.stopPropagation()}>
                              {parent.summary}
                            </a>
                          </td>
                          <td className="text-center">-</td>
                          <td className="text-center">
                            <span className={`status-badge ${parent.isCompleted ? 'success' : 'info'}`} style={{ fontSize: '10px' }}>{parent.status}</span>
                          </td>
                          <td className="text-center" style={{ color: 'var(--accent-blue)' }}>
                            {formatEstimate(parentDevEst)}
                          </td>
                          <td className="text-center" style={{ color: 'var(--accent-green)' }}>
                            {formatEstimate(parentQaEst)}
                          </td>
                          <td className="text-center" style={{ fontWeight: '600' }}>
                            {formatEstimate(parentTotalEst)}
                          </td>
                          <td className="text-center" style={{ color: 'var(--accent-purple)' }}>
                            {formatEstimate(parentWorkLogged)}
                          </td>
                          {showDueDate && (
                            <td className="text-center">
                              {parent.dueDate ? format(new Date(parent.dueDate), 'MMM d') : '-'}
                            </td>
                          )}
                          {showDelay && (
                            <td className="text-center">
                              {getDelayReason(parent) && <span className="status-badge danger">{getDelayReason(parent)}</span>}
                            </td>
                          )}
                        </tr>

                        {/* Subtask Rows */}
                        {isParentExpanded && subtasks.map(st => {
                          const delayReason = showDelay ? getDelayReason(st) : null;
                          return (
                            <tr key={st.key} style={{ backgroundColor: 'var(--bg-secondary)', ...getRowStyle(st) }}>
                              <td style={{ paddingLeft: '48px' }}>
                                <a href={getJiraLink(jiraBaseUrl, st.key)} target="_blank" rel="noopener noreferrer" className="issue-key" style={{ fontSize: '11px', textDecoration: 'none' }}>
                                  {st.key} <ExternalLink size={9} />
                                </a>
                              </td>
                              <td style={{ fontSize: '12px' }}>
                                <a href={getJiraLink(jiraBaseUrl, st.key)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                                  {st.summary}
                                </a>
                              </td>
                              <td className="text-center" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                <a href={getJiraLink(jiraBaseUrl, parent.key)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--text-muted)' }} onClick={(e) => e.stopPropagation()}>
                                  {parent.key}
                                </a>
                              </td>
                              <td className="text-center">
                                <span className={`status-badge ${st.isCompleted ? 'success' : 'info'}`} style={{ fontSize: '10px' }}>{st.status}</span>
                              </td>
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
                              {showDueDate && (
                                <td className="text-center" style={{ fontSize: '12px' }}>
                                  {st.dueDate ? format(new Date(st.dueDate), 'MMM d') : '-'}
                                </td>
                              )}
                              {showDelay && (
                                <td className="text-center">
                                  {delayReason && <span className="status-badge danger">{delayReason}</span>}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
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

export default MemberIssuesTable;
