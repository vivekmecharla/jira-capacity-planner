import React, { useState, useMemo, useEffect } from 'react';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, differenceInDays, isWithinInterval, parseISO, startOfDay, isSameDay } from 'date-fns';
import { configApi } from '../api';

const getJiraLink = (baseUrl, issueKey) => `${baseUrl}/browse/${issueKey}`;

function TeamTimeline({ planningData, sprint, loading, jiraBaseUrl = '' }) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);

  // Fetch holidays and leaves data
  useEffect(() => {
    const fetchHolidaysAndLeaves = async () => {
      try {
        const [holidaysRes, leavesRes] = await Promise.all([
          configApi.getHolidays(),
          configApi.getLeaves()
        ]);
        setHolidays(holidaysRes.data || []);
        setLeaves(leavesRes.data || []);
      } catch (err) {
        console.error('Failed to load holidays/leaves:', err);
      }
    };
    fetchHolidaysAndLeaves();
  }, []);

  // Check if a date is a holiday
  const getHolidayForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.find(h => h.date === dateStr);
  };

  // Check if a member has leave on a specific date
  const getLeaveForMemberOnDate = (accountId, date) => {
    const dateStart = startOfDay(date);
    return leaves.find(leave => {
      if (leave.accountId !== accountId) return false;
      try {
        const leaveStart = startOfDay(parseISO(leave.startDate));
        const leaveEnd = startOfDay(parseISO(leave.endDate));
        return isWithinInterval(dateStart, { start: leaveStart, end: leaveEnd });
      } catch (e) {
        return false;
      }
    });
  };

  // Check if member has leave on a date (for task breaking)
  const hasLeaveOnDate = (accountId, date) => {
    return !!getLeaveForMemberOnDate(accountId, date);
  };

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

  // Generate array of dates for the timeline (excluding weekends)
  const timelineDates = useMemo(() => {
    try {
      const dates = [];
      for (let i = 0; i < sprintDays; i++) {
        const date = addDays(sprintStart, i);
        // Skip weekends (Saturday = 6, Sunday = 0)
        if (date.getDay() !== 0 && date.getDay() !== 6) {
          dates.push(date);
        }
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
        const assignedIssues = (member?.work?.assignedIssues || []).filter(issue => !issue.isCompletedBeforeSprint);
        const tasks = assignedIssues.map(issue => {
          // Parse dates from issue
          let dueDate = null;
          let issueStartDate = null;
          const dueDateStr = issue.dueDate || issue.duedate;
          const startDateStr = issue.startDate; // Start date field from Jira
          
          try {
            dueDate = dueDateStr ? startOfDay(parseISO(dueDateStr)) : null;
          } catch (e) {
            dueDate = null;
          }
          
          try {
            issueStartDate = startDateStr ? startOfDay(parseISO(startDateStr)) : null;
          } catch (e) {
            issueStartDate = null;
          }
          
          const estimateHours = issue.originalEstimate || 8;
          const estimateDays = Math.max(1, Math.ceil(estimateHours / 8));
        
          // Calculate start and end dates:
          // Priority: Use issue's start date if available, due date as end
          // If only due date: work backwards from due date based on estimate
          // If only start date: work forwards from start based on estimate
          // If neither: place at sprint start
          let taskStartDate, taskEndDate;
          
          if (issueStartDate && dueDate) {
            // Both dates available - use them directly
            taskStartDate = issueStartDate < sprintStart ? sprintStart : issueStartDate;
            taskEndDate = dueDate > sprintEnd ? sprintEnd : dueDate;
            // Ensure start is not after end
            if (taskStartDate > taskEndDate) {
              taskStartDate = taskEndDate;
            }
          } else if (dueDate) {
            // Only due date - work backwards from due date
            taskEndDate = dueDate > sprintEnd ? sprintEnd : dueDate;
            taskStartDate = addDays(taskEndDate, -estimateDays + 1);
            if (taskStartDate < sprintStart) {
              taskStartDate = sprintStart;
            }
          } else if (issueStartDate) {
            // Only start date - work forwards from start based on estimate
            taskStartDate = issueStartDate < sprintStart ? sprintStart : issueStartDate;
            taskEndDate = addDays(taskStartDate, estimateDays - 1);
            if (taskEndDate > sprintEnd) {
              taskEndDate = sprintEnd;
            }
          } else {
            // No dates - place at sprint start based on estimate
            taskStartDate = sprintStart;
            taskEndDate = addDays(sprintStart, Math.min(estimateDays - 1, sprintDays - 1));
          }

          return {
            ...issue,
            startDate: taskStartDate,
            endDate: taskEndDate,
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

  // Highly contrasting color palette for tasks - very distinct colors
  const TASK_COLORS = [
    '#e11d48', // Rose/Pink
    '#2563eb', // Blue
    '#16a34a', // Green
    '#ea580c', // Orange
    '#7c3aed', // Purple
    '#0891b2', // Cyan
    '#ca8a04', // Yellow/Gold
    '#dc2626', // Red
    '#4f46e5', // Indigo
    '#059669', // Emerald
    '#d946ef', // Fuchsia
    '#0284c7', // Sky blue
    '#65a30d', // Lime
    '#c026d3', // Pink/Magenta
    '#0d9488', // Teal
  ];
  
  // Get a consistent color for a task based on its key (hash-based)
  const getTaskColorByKey = (taskKey) => {
    let hash = 0;
    for (let i = 0; i < taskKey.length; i++) {
      hash = taskKey.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TASK_COLORS[Math.abs(hash) % TASK_COLORS.length];
  };

  // Check if a task spans a specific date and return position info
  const getTaskPositionForDate = (task, date, dateIndex) => {
    if (!task.startDate || !task.endDate) return null;
    
    const dateStart = startOfDay(date);
    const taskStart = startOfDay(task.startDate);
    const taskEnd = startOfDay(task.endDate);
    
    if (!isWithinInterval(dateStart, { start: taskStart, end: taskEnd })) {
      return null;
    }
    
    const isFirst = format(dateStart, 'yyyy-MM-dd') === format(taskStart, 'yyyy-MM-dd');
    const isLast = format(dateStart, 'yyyy-MM-dd') === format(taskEnd, 'yyyy-MM-dd');
    const isMiddle = !isFirst && !isLast;
    
    return { isFirst, isLast, isMiddle };
  };

  // Get tasks for a member on a specific date with position info
  // Sort by task key to ensure consistent ordering across all days
  const getTasksForDate = (tasks, date, dateIndex) => {
    return tasks
      .map(task => {
        const position = getTaskPositionForDate(task, date, dateIndex);
        if (!position) return null;
        return { ...task, position };
      })
      .filter(Boolean)
      .sort((a, b) => a.key.localeCompare(b.key));
  };
  
  // Get all unique tasks for a member (for consistent row ordering)
  const getAllTasksForMember = (tasks) => {
    return [...tasks].sort((a, b) => a.key.localeCompare(b.key));
  };

  // Check if task should show label on this date (first day or after a break)
  const shouldShowTaskLabel = (task, date, dateIndex, accountId) => {
    const position = getTaskPositionForDate(task, date, dateIndex);
    if (!position) return false;
    
    // Always show on first day
    if (position.isFirst) return true;
    
    // Check if previous day was a leave or holiday (task is resuming)
    if (dateIndex > 0) {
      const prevDate = timelineDates[dateIndex - 1];
      if (prevDate) {
        const hadLeave = hasLeaveOnDate(accountId, prevDate);
        const hadHoliday = !!getHolidayForDate(prevDate);
        if (hadLeave || hadHoliday) return true;
      }
    }
    
    return false;
  };

  // Check if task continues after a break on this date
  const isTaskContinuingAfterBreak = (task, date, dateIndex, accountId) => {
    const position = getTaskPositionForDate(task, date, dateIndex);
    if (!position || position.isFirst) return false;
    
    if (dateIndex > 0) {
      const prevDate = timelineDates[dateIndex - 1];
      if (prevDate) {
        const hadLeave = hasLeaveOnDate(accountId, prevDate);
        const hadHoliday = !!getHolidayForDate(prevDate);
        return hadLeave || hadHoliday;
      }
    }
    return false;
  };

  // Check if task will break after this date (next day is leave/holiday)
  const willTaskBreakAfterDate = (task, date, dateIndex, accountId) => {
    const position = getTaskPositionForDate(task, date, dateIndex);
    if (!position || position.isLast) return false;
    
    if (dateIndex < timelineDates.length - 1) {
      const nextDate = timelineDates[dateIndex + 1];
      if (nextDate) {
        const hasLeaveNext = hasLeaveOnDate(accountId, nextDate);
        const hasHolidayNext = !!getHolidayForDate(nextDate);
        return hasLeaveNext || hasHolidayNext;
      }
    }
    return false;
  };

  // Modal/Popup component - click to open, click outside to close
  const TaskPopup = ({ task, onClose }) => {
    if (!task) return null;

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
            zIndex: 999
          }}
          onClick={onClose}
        />
        {/* Popup */}
        <div
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            zIndex: 1000,
            minWidth: '400px',
            maxWidth: '650px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <a 
                  href={getJiraLink(jiraBaseUrl, task.key)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="issue-key"
                  style={{ fontWeight: '600', fontSize: '14px' }}
                >
                  {task.key} <ExternalLink size={12} />
                </a>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>- {task.summary}</span>
                <span className={`status-badge ${task.issueType === 'Bug' ? 'danger' : 'info'}`} style={{ fontSize: '10px' }}>
                  {task.issueType}
                </span>
              </div>
              {task.parentKey && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Parent: <a href={getJiraLink(jiraBaseUrl, task.parentKey)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>
                    {task.parentKey}
                  </a>
                  {task.parentSummary && <span style={{ marginLeft: '4px' }}>- {task.parentSummary}</span>}
                </div>
              )}
            </div>
            <button 
              onClick={onClose}
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                fontSize: '18px',
                color: 'var(--text-muted)',
                padding: '4px',
                marginLeft: '8px'
              }}
            >
              ×
            </button>
          </div>
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
          
          {/* Time Tracking Section */}
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Time Tracking
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Logged:</span>
                <span style={{ marginLeft: '4px', fontWeight: '600', color: 'var(--accent-blue)' }}>
                  {task.workLogged ? `${(task.workLogged / 8).toFixed(1)}d` : '0d'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Remaining:</span>
                <span style={{ marginLeft: '4px', fontWeight: '600', color: task.remainingEstimate > 0 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                  {task.remainingEstimate ? `${(task.remainingEstimate / 8).toFixed(1)}d` : '0d'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total Time:</span>
                <span style={{ marginLeft: '4px', fontWeight: '600' }}>
                  {task.timeSpent ? `${(task.timeSpent / 8).toFixed(1)}d` : '-'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Original:</span>
                <span style={{ marginLeft: '4px', fontWeight: '600' }}>
                  {task.originalEstimate ? `${(task.originalEstimate / 8).toFixed(1)}d` : '-'}
                </span>
              </div>
            </div>
            
            {/* Progress Bar */}
            {(task.workLogged > 0 || task.remainingEstimate > 0) && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ 
                  height: '6px', 
                  backgroundColor: 'var(--border-color)', 
                  borderRadius: '3px', 
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${task.originalEstimate > 0 ? Math.min((task.workLogged / task.originalEstimate) * 100, 100) : 0}%`,
                    backgroundColor: 'var(--accent-blue)',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{ 
                  fontSize: '9px', 
                  color: 'var(--text-muted)', 
                  marginTop: '2px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>{task.workLogged ? `${(task.workLogged / 8).toFixed(1)}d logged` : '0d logged'}</span>
                  <span>{task.originalEstimate ? `${(task.originalEstimate / 8).toFixed(1)}d total` : '-'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
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

      {/* Legend - Note about colors */}
      <div className="card mb-4" style={{ padding: '12px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <span><strong>Legend:</strong></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '16px', height: '16px', background: '#FFA500', borderRadius: '3px', display: 'inline-block' }}></span>
            Holiday
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '16px', height: '16px', background: 'rgba(234, 179, 8, 0.3)', border: '2px solid var(--accent-yellow)', borderRadius: '3px', display: 'inline-block' }}></span>
            Planned Leave
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '16px', height: '16px', background: 'rgba(239, 68, 68, 0.3)', border: '2px solid var(--accent-red)', borderRadius: '3px', display: 'inline-block' }}></span>
            Unplanned Leave
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '16px', height: '16px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '3px', display: 'inline-block' }}></span>
            Today
          </span>
          <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>Click on a ticket bar to view details</span>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: `${150 + timelineDates.length * 80}px` }}>
          <colgroup>
            <col style={{ width: '150px' }} />
            {timelineDates.map((_, idx) => (
              <col key={idx} style={{ width: '80px' }} />
            ))}
          </colgroup>
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
                const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                const holiday = getHolidayForDate(date);
                return (
                  <th 
                    key={idx}
                    style={{ 
                      padding: '4px',
                      borderBottom: '1px solid var(--border-color)',
                      width: '80px',
                      textAlign: 'center',
                      fontSize: '10px',
                      background: holiday ? '#FFA500' : isToday ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                      color: holiday ? '#000' : 'var(--text-secondary)'
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
                {(() => {
                  // Get all tasks sorted by key for consistent row ordering
                  const sortedTasks = getAllTasksForMember(tasks);
                  const accountId = member.accountId;
                  
                  return timelineDates.map((date, idx) => {
                    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    const holiday = getHolidayForDate(date);
                    const memberLeave = getLeaveForMemberOnDate(accountId, date);
                    
                    // If it's a holiday, show holiday column
                    if (holiday) {
                      return (
                        <td 
                          key={idx}
                          style={{ 
                            padding: '0',
                            borderBottom: '1px solid var(--border-color)',
                            borderLeft: '1px solid var(--border-color)',
                            verticalAlign: 'middle',
                            background: '#FFA500',
                            minHeight: '40px',
                            position: 'relative'
                          }}
                        >
                          <div style={{ 
                            writingMode: 'vertical-rl',
                            textOrientation: 'mixed',
                            transform: 'rotate(180deg)',
                            fontSize: '10px',
                            fontWeight: '600',
                            color: '#000',
                            padding: '4px 2px',
                            textAlign: 'center',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: `${Math.max(sortedTasks.length * 19, 40)}px`
                          }}>
                            {holiday.name}
                          </div>
                        </td>
                      );
                    }
                    
                    // If member has leave on this day
                    if (memberLeave) {
                      const isUnplanned = memberLeave.isUnplanned;
                      const leaveColor = isUnplanned 
                        ? 'rgba(239, 68, 68, 0.3)' // Red for unplanned
                        : 'rgba(234, 179, 8, 0.3)'; // Yellow/amber for planned
                      const leaveBorderColor = isUnplanned 
                        ? 'var(--accent-red)' 
                        : 'var(--accent-yellow)';
                      const leaveTextColor = isUnplanned 
                        ? 'var(--accent-red)' 
                        : 'var(--accent-yellow)';
                      
                      return (
                        <td 
                          key={idx}
                          style={{ 
                            padding: '2px 0',
                            borderBottom: '1px solid var(--border-color)',
                            borderLeft: `2px solid ${leaveBorderColor}`,
                            verticalAlign: 'top',
                            background: leaveColor,
                            minHeight: '40px'
                          }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: `${Math.max(sortedTasks.length * 19, 40)}px`,
                            fontSize: '9px',
                            fontWeight: '600',
                            color: leaveTextColor,
                            textAlign: 'center',
                            padding: '4px'
                          }}>
                            <div>{isUnplanned ? 'Unplanned' : 'Leave'}</div>
                            {memberLeave.isHalfDay && <div style={{ fontSize: '8px' }}>(½ Day)</div>}
                          </div>
                        </td>
                      );
                    }
                    
                    return (
                      <td 
                        key={idx}
                        style={{ 
                          padding: '2px 0',
                          borderBottom: '1px solid var(--border-color)',
                          borderLeft: '1px solid var(--border-color)',
                          verticalAlign: 'top',
                          background: isToday ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                          minHeight: '40px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          {sortedTasks.map((task, taskIdx) => {
                            const position = getTaskPositionForDate(task, date, idx);
                            const taskColor = getTaskColorByKey(task.key);
                            
                            // If task is not active on this day, render empty placeholder
                            if (!position) {
                              return (
                                <div
                                  key={task.key + taskIdx}
                                  style={{
                                    minHeight: '18px',
                                    padding: '3px 4px',
                                  }}
                                />
                              );
                            }
                            
                            const { isFirst, isLast } = position;
                            const showLabel = shouldShowTaskLabel(task, date, idx, accountId);
                            const isContinuing = isTaskContinuingAfterBreak(task, date, idx, accountId);
                            const willBreak = willTaskBreakAfterDate(task, date, idx, accountId);
                            
                            // Determine border radius based on breaks
                            let borderRadius = '0';
                            if ((isFirst || isContinuing) && (isLast || willBreak)) {
                              borderRadius = '4px';
                            } else if (isFirst || isContinuing) {
                              borderRadius = '4px 0 0 4px';
                            } else if (isLast || willBreak) {
                              borderRadius = '0 4px 4px 0';
                            }
                            
                            // Calculate how many days this task segment spans (for description display)
                            const getSegmentDays = () => {
                              let days = 1;
                              // Count forward until break or end
                              for (let i = idx + 1; i < timelineDates.length; i++) {
                                const futureDate = timelineDates[i];
                                const futurePos = getTaskPositionForDate(task, futureDate, i);
                                if (!futurePos) break;
                                const futureHoliday = getHolidayForDate(futureDate);
                                const futureLeave = hasLeaveOnDate(accountId, futureDate);
                                if (futureHoliday || futureLeave) break;
                                days++;
                                if (futurePos.isLast) break;
                              }
                              return days;
                            };
                            
                            const segmentDays = showLabel ? getSegmentDays() : 0;
                            const showDescription = showLabel && segmentDays >= 2;
                            const displayText = showLabel 
                              ? (showDescription ? `${task.key}: ${task.summary}` : task.key)
                              : '';
                            
                            return (
                              <div
                                key={task.key + taskIdx}
                                onClick={() => setSelectedTask(task)}
                                style={{
                                  background: taskColor,
                                  borderRadius: borderRadius,
                                  padding: '3px 6px',
                                  marginLeft: (isFirst || isContinuing) ? '2px' : '0',
                                  marginRight: (isLast || willBreak) ? '2px' : '0',
                                  fontSize: '9px',
                                  color: 'white',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  opacity: task.isCompleted ? 0.6 : 1,
                                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                                  minHeight: '18px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                title={`${task.key}: ${task.summary}`}
                              >
                                {displayText}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  });
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Task Popup */}
      {selectedTask && (
        <TaskPopup task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}

export default TeamTimeline;
