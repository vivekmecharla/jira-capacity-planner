import React, { useState, useMemo } from 'react';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, differenceInDays, isWithinInterval, parseISO, startOfDay } from 'date-fns';

const getJiraLink = (baseUrl, issueKey) => `${baseUrl}/browse/${issueKey}`;

function TeamTimeline({ planningData, sprint, loading, jiraBaseUrl = '' }) {
  const [hoveredTask, setHoveredTask] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading timeline data...</p>
      </div>
    );
  }

  if (!planningData || !sprint || !planningData.planning) {
    return (
      <div className="card">
        <div className="empty-state">
          <p>Select a sprint to view the team timeline</p>
        </div>
      </div>
    );
  }

  const { planning } = planningData;
  const members = planning?.members || [];

  // Calculate sprint date range with error handling
  let sprintStart, sprintEnd, sprintDays;
  try {
    sprintStart = sprint.startDate ? startOfDay(parseISO(sprint.startDate)) : new Date();
    sprintEnd = sprint.endDate ? startOfDay(parseISO(sprint.endDate)) : addDays(sprintStart, 14);
    sprintDays = differenceInDays(sprintEnd, sprintStart) + 1;
    // Ensure sprintDays is reasonable
    if (sprintDays <= 0 || sprintDays > 60) {
      sprintDays = 14;
      sprintEnd = addDays(sprintStart, 13);
    }
  } catch (err) {
    console.error('Error parsing sprint dates:', err);
    sprintStart = new Date();
    sprintEnd = addDays(sprintStart, 13);
    sprintDays = 14;
  }

  // Generate array of dates for the timeline
  const timelineDates = useMemo(() => {
    try {
      const dates = [];
      for (let i = 0; i < sprintDays; i++) {
        dates.push(addDays(sprintStart, i));
      }
      return dates;
    } catch (err) {
      console.error('Error generating timeline dates:', err);
      return [];
    }
  }, [sprintStart, sprintDays]);

  // Process member tasks with dates
  const memberTimelines = useMemo(() => {
    try {
      if (!members || members.length === 0) return [];
      return members.map(member => {
        const assignedIssues = member?.work?.assignedIssues || [];
        const tasks = assignedIssues.map(issue => {
          // Use due date as end, and estimate start based on estimate
          // Note: backend sends 'dueDate' (we added it), check both cases
          let dueDate = null;
          const dueDateStr = issue.dueDate || issue.duedate;
          try {
            dueDate = dueDateStr ? startOfDay(parseISO(dueDateStr)) : null;
          } catch (e) {
            dueDate = null;
          }
          
          const estimateHours = issue.originalEstimate || 8;
          const estimateDays = Math.max(1, Math.ceil(estimateHours / 8));
        
          // Calculate start date: if due date exists, work backwards from due date
          // Otherwise, distribute tasks across the sprint based on their index
          let startDate, endDate;
          if (dueDate) {
            endDate = dueDate;
            startDate = addDays(dueDate, -estimateDays + 1);
            // Ensure start is not before sprint start
            if (startDate < sprintStart) {
              startDate = sprintStart;
            }
            // Ensure end is not after sprint end
            if (endDate > sprintEnd) {
              endDate = sprintEnd;
            }
          } else {
            // No due date - spread tasks across sprint based on estimate
            // Place at sprint start but limit to sprint duration
            startDate = sprintStart;
            endDate = addDays(sprintStart, Math.min(estimateDays - 1, sprintDays - 1));
          }

          return {
            ...issue,
            startDate,
            endDate,
            estimateDays
          };
        });

        return {
          member: member.member,
          tasks,
          availability: member.availability
        };
      });
    } catch (err) {
      console.error('Error processing member timelines:', err);
      return [];
    }
  }, [members, sprintStart, sprintEnd, sprintDays]);

  // Color palette for tasks
  const getTaskColor = (issueType, isSubtask) => {
    if (isSubtask) return 'var(--accent-cyan)';
    switch (issueType) {
      case 'Story': return 'var(--accent-green)';
      case 'Task': return 'var(--accent-blue)';
      case 'Bug': return 'var(--accent-red)';
      case 'Technical Task': return 'var(--accent-purple)';
      default: return 'var(--accent-orange)';
    }
  };

  // Check if a task spans a specific date
  const taskSpansDate = (task, date) => {
    if (!task.startDate || !task.endDate) return false;
    return isWithinInterval(startOfDay(date), {
      start: startOfDay(task.startDate),
      end: startOfDay(task.endDate)
    });
  };

  // Get tasks for a member on a specific date
  const getTasksForDate = (tasks, date) => {
    return tasks.filter(task => taskSpansDate(task, date));
  };

  // Tooltip component
  const TaskTooltip = ({ task, position }) => {
    if (!task) return null;

    return (
      <div
        style={{
          position: 'fixed',
          left: position.x + 10,
          top: position.y + 10,
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '12px',
          zIndex: 1000,
          maxWidth: '350px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <a 
            href={getJiraLink(jiraBaseUrl, task.key)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="issue-key"
            style={{ fontWeight: '600', fontSize: '14px' }}
          >
            {task.key} <ExternalLink size={12} />
          </a>
          <span className={`status-badge ${task.issueType === 'Bug' ? 'danger' : 'info'}`} style={{ fontSize: '10px' }}>
            {task.issueType}
          </span>
        </div>
        <div style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--text-primary)' }}>
          {task.summary}
        </div>
        {task.parentKey && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Parent: <a href={getJiraLink(jiraBaseUrl, task.parentKey)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>
              {task.parentKey}
            </a>
            {task.parentStoryPoints && <span> ({task.parentStoryPoints} SP)</span>}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Estimate:</span>
            <span style={{ marginLeft: '4px', fontWeight: '600' }}>
              {task.originalEstimate ? `${(task.originalEstimate / 8).toFixed(1)}d` : '-'}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Status:</span>
            <span className={`status-badge ${task.isCompleted ? 'success' : 'info'}`} style={{ marginLeft: '4px', fontSize: '10px' }}>
              {task.status}
            </span>
          </div>
          {task.dueDate && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Due:</span>
              <span style={{ marginLeft: '4px' }}>{format(parseISO(task.dueDate), 'MMM d')}</span>
            </div>
          )}
          {task.storyPoints && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Story Points:</span>
              <span style={{ marginLeft: '4px', fontWeight: '600', color: 'var(--accent-purple)' }}>{task.storyPoints}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Sprint Info */}
      <div className="card mb-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
              Team Timeline - {sprint.name}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {format(sprintStart, 'MMM d, yyyy')} - {format(sprintEnd, 'MMM d, yyyy')} ({sprintDays} days)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setWeekOffset(prev => prev - 1)}
              disabled={weekOffset <= 0}
              style={{ padding: '4px 8px' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => setWeekOffset(0)}
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              Today
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => setWeekOffset(prev => prev + 1)}
              disabled={weekOffset >= Math.floor(sprintDays / 7)}
              style={{ padding: '4px 8px' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="card mb-4" style={{ padding: '12px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-green)' }} />
            <span>Story</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-blue)' }} />
            <span>Task</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-purple)' }} />
            <span>Technical Task</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-red)' }} />
            <span>Bug</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-cyan)' }} />
            <span>Subtask</span>
          </div>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${150 + timelineDates.length * 40}px` }}>
          <thead>
            <tr>
              <th style={{ 
                position: 'sticky', 
                left: 0, 
                background: 'var(--bg-card)', 
                zIndex: 2,
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                minWidth: '150px',
                textAlign: 'left'
              }}>
                Team Member
              </th>
              {timelineDates.map((date, idx) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return (
                  <th 
                    key={idx}
                    style={{ 
                      padding: '4px',
                      borderBottom: '1px solid var(--border-color)',
                      minWidth: '40px',
                      textAlign: 'center',
                      fontSize: '10px',
                      background: isToday ? 'rgba(59, 130, 246, 0.2)' : isWeekend ? 'rgba(0,0,0,0.1)' : 'transparent',
                      color: isWeekend ? 'var(--text-muted)' : 'var(--text-secondary)'
                    }}
                  >
                    <div>{format(date, 'EEE')}</div>
                    <div style={{ fontWeight: '600' }}>{format(date, 'd')}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {memberTimelines.map(({ member, tasks }) => (
              <tr key={member.accountId}>
                <td style={{ 
                  position: 'sticky', 
                  left: 0, 
                  background: 'var(--bg-card)', 
                  zIndex: 1,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border-color)',
                  fontWeight: '500'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '12px' }}>
                      {member.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span style={{ fontSize: '13px' }}>{member.displayName}</span>
                  </div>
                </td>
                {timelineDates.map((date, idx) => {
                  const dayTasks = getTasksForDate(tasks, date);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  
                  return (
                    <td 
                      key={idx}
                      style={{ 
                        padding: '2px',
                        borderBottom: '1px solid var(--border-color)',
                        borderLeft: '1px solid var(--border-color)',
                        verticalAlign: 'top',
                        background: isToday ? 'rgba(59, 130, 246, 0.1)' : isWeekend ? 'rgba(0,0,0,0.05)' : 'transparent',
                        minHeight: '40px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {dayTasks.slice(0, 3).map((task, taskIdx) => (
                          <div
                            key={task.key + taskIdx}
                            onMouseEnter={(e) => setHoveredTask({ task, position: { x: e.clientX, y: e.clientY } })}
                            onMouseLeave={() => setHoveredTask(null)}
                            style={{
                              background: getTaskColor(task.issueType, task.isSubtask),
                              borderRadius: '3px',
                              padding: '2px 4px',
                              fontSize: '9px',
                              color: 'white',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              opacity: task.isCompleted ? 0.6 : 1
                            }}
                            title={`${task.key}: ${task.summary}`}
                          >
                            {task.key}
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            +{dayTasks.length - 3}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hover Tooltip */}
      {hoveredTask && <TaskTooltip task={hoveredTask.task} position={hoveredTask.position} />}
    </div>
  );
}

export default TeamTimeline;
