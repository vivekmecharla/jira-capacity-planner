import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ExternalLink, Filter, X, Maximize2, Minimize2, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import IssuesTable from './IssuesTable';
import LeavesModal from './LeavesModal';

function SprintPlanning({ planningData, loading, error, sprint, onRefresh, jiraBaseUrl = '' }) {
  const [expandedMembers, setExpandedMembers] = useState({});
  
  // Collapsible section states
  const [showTeamMembers, setShowTeamMembers] = useState(false);
  const [showLeaves, setShowLeaves] = useState(false);
  const [showLeavesModal, setShowLeavesModal] = useState(false);
  
  // Sort and filter state for Team Capacity table
  const [teamSort, setTeamSort] = useState({ column: null, direction: 'asc' });
  const [teamFilter, setTeamFilter] = useState('');
  const [showTeamFilter, setShowTeamFilter] = useState(false);
  
  // Tooltip state for availability hover
  const [hoveredMember, setHoveredMember] = useState(null);
  
  // Chart colors
  const COLORS = {
    committed: '#a855f7',
    remaining: '#22c55e',
    overcommitted: '#ef4444',
    techStories: '#3b82f6',
    prodIssues: '#ef4444',
    carryover: '#f97316',
    devLead: '#3b82f6',
    developer: '#22c55e',
    qaLead: '#a855f7',
    qa: '#06b6d4',
    sprintHead: '#f97316'
  };
  
  // Jira base URL for ticket links
  const getJiraLink = (baseUrl, issueKey) => `${baseUrl}/browse/${issueKey}`;

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading sprint planning data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="empty-state">
          <p>{error}</p>
          <p className="mt-4" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Make sure to add team members in the Team tab first.
          </p>
        </div>
      </div>
    );
  }

  if (!planningData || !planningData.planning) {
    return (
      <div className="card">
        <div className="empty-state">
          <p>Select a sprint to view planning data</p>
        </div>
      </div>
    );
  }

  const { planning, sprint: sprintInfo } = planningData;
  
  // Restrict Sprint Planning for closed sprints
  if (sprint?.state === 'closed') {
    return (
      <div className="card">
        <div className="empty-state">
          <div style={{ marginBottom: '16px' }}>
            <span className="status-badge" style={{ fontSize: '12px', backgroundColor: 'var(--text-muted)', padding: '6px 12px' }}>
              Sprint Closed
            </span>
          </div>
          <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>{sprint.name}</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
            Sprint Planning is not available for closed sprints.
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Please use the <strong>Sprint Retro</strong> tab to view historical data for this sprint.
          </p>
        </div>
      </div>
    );
  }
  const members = planning?.members || [];
  const totals = planning?.totals || {};
  const holidays = planning?.holidays || [];
  const sprintConfig = planning?.sprintConfig || {};
  const hoursPerDay = sprintConfig?.hoursPerDay || totals?.hoursPerDay || 8;

  const toggleMemberExpand = (accountId) => {
    setExpandedMembers(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  const expandAllMembers = () => {
    const allExpanded = {};
    members.forEach(item => {
      if (item.work.issueCount > 0) {
        allExpanded[item.member.accountId] = true;
      }
    });
    setExpandedMembers(allExpanded);
  };

  const collapseAllMembers = () => {
    setExpandedMembers({});
  };

  const getUtilizationStatus = (percent) => {
    if (percent > 100) return 'danger';
    if (percent > 80) return 'warning';
    return 'success';
  };

  // Sort helper function
  const handleSort = (currentSort, setSort, column) => {
    if (currentSort.column === column) {
      setSort({ column, direction: currentSort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ column, direction: 'asc' });
    }
  };

  // Sort data helper
  const sortData = (data, sort, getValue) => {
    if (!sort.column) return data;
    return [...data].sort((a, b) => {
      const aVal = getValue(a, sort.column);
      const bVal = getValue(b, sort.column);
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

  // Sortable header component
  const SortHeader = ({ label, column, sort, onSort, className = '' }) => (
    <th 
      className={className}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSort(column)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: className.includes('text-center') ? 'center' : 'flex-start', gap: '4px' }}>
        {label}
        {sort.column === column && (
          sort.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        )}
      </div>
    </th>
  );

  // Filter toolbar component
  const FilterToolbar = ({ show, setShow, filter, setFilter, placeholder = 'Filter by name, key, status...' }) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
      {show && (
        <input
          type="text"
          placeholder={placeholder}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            width: '200px'
          }}
        />
      )}
      <button
        className={`btn btn-sm ${show ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() => setShow(!show)}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
      >
        <Filter size={12} />
        Filter
      </button>
      {filter && (
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => setFilter('')}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  );

  const formatHours = (hours) => {
    if (!hours && hours !== 0) return '-';
    return `${hours.toFixed(1)}h`;
  };

  return (
    <>
    <div>
      {/* Sprint Info */}
      <div className="card mb-4">
        <div className="card-header">
          <div>
            <h2 className="card-title">{sprintInfo?.name || 'Sprint'}</h2>
            {sprintInfo?.startDate && sprintInfo?.endDate && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {format(new Date(sprintInfo.startDate), 'MMM d, yyyy')} - {format(new Date(sprintInfo.endDate), 'MMM d, yyyy')}
              </p>
            )}
          </div>
          <span className={`status-badge ${sprintInfo?.state === 'active' ? 'success' : 'info'}`}>
            {sprintInfo?.state?.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Two Column Layout: Charts + Team Capacity Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Left Column - Charts and Collapsible Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(() => {
            // Filter out issues completed before sprint start
            const filterIssues = (issues) => issues.filter(issue => !issue.isCompletedBeforeSprint);
            
            const allIssues = members.flatMap(m => filterIssues(m.work.assignedIssues));
            const parentIssues = allIssues.filter(i => !i.isSubtask);
            const carryoverCount = parentIssues.filter(i => i.isCarryover).length;
            const techStoriesAll = parentIssues.filter(i => 
              i.issueType === 'Story' || i.issueType === 'Task' || i.issueType === 'Technical Task'
            );
            const prodIssuesAll = parentIssues.filter(i => 
              i.issueType === 'Bug' || i.issueType === 'Incident' || i.issueType === 'Production Issue'
            );
            const techStoriesCount = techStoriesAll.length;
            const prodIssuesCount = prodIssuesAll.length;
            const techCarryover = techStoriesAll.filter(i => i.isCarryover).length;
            const prodCarryover = prodIssuesAll.filter(i => i.isCarryover).length;
            
            // Team count by role - exclude Unassigned
            const roleCount = {};
            const actualMembers = members.filter(m => m.member.accountId !== 'unassigned');
            actualMembers.forEach(m => {
              const role = m.availability?.role || 'Developer';
              roleCount[role] = (roleCount[role] || 0) + 1;
            });

            // Capacity pie chart data
            const committedHours = totals.totalCommitted || 0;
            const remainingHours = Math.max(0, totals.totalRemaining || 0);
            const overcommittedHours = totals.totalRemaining < 0 ? Math.abs(totals.totalRemaining) : 0;
            
            const capacityData = overcommittedHours > 0 
              ? [
                  { name: 'Committed', value: totals.totalTeamCapacity, color: COLORS.committed },
                  { name: 'Overcommitted', value: overcommittedHours, color: COLORS.overcommitted }
                ]
              : [
                  { name: 'Committed', value: committedHours, color: COLORS.committed },
                  { name: 'Remaining', value: remainingHours, color: COLORS.remaining }
                ];

            // Sprint overview pie data - total issues breakdown
            const totalIssues = techStoriesCount + prodIssuesCount;
            const sprintOverviewData = [
              { name: `Tech Stories (${techCarryover} carried)`, value: techStoriesCount, color: COLORS.techStories },
              { name: `Prod Issues (${prodCarryover} carried)`, value: prodIssuesCount, color: COLORS.prodIssues }
            ].filter(d => d.value > 0);

            // Team members pie data
            const roleColors = {
              'Dev Lead': COLORS.devLead,
              'Developer': COLORS.developer,
              'QA Lead': COLORS.qaLead,
              'QA': COLORS.qa,
              'Sprint Head': COLORS.sprintHead
            };
            const teamMembersData = Object.entries(roleCount).map(([role, count]) => ({
              name: role,
              value: count,
              color: roleColors[role] || '#71717a'
            }));

            // All leaves data
            const allLeaves = members
              .filter(m => m.availability?.leaves && m.availability.leaves.length > 0)
              .flatMap(m => m.availability.leaves.map(l => ({
                ...l,
                memberName: m.member.displayName,
                memberAccountId: m.member.accountId
              })));

            // Custom tooltip for pie charts
            const CustomTooltip = ({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px'
                  }}>
                    <p style={{ color: payload[0].payload.color, fontWeight: '600' }}>
                      {payload[0].name}: {payload[0].value}
                    </p>
                  </div>
                );
              }
              return null;
            };

            // Custom label for pie charts
            const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
              if (percent < 0.05) return null;
              const RADIAN = Math.PI / 180;
              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
              const x = cx + radius * Math.cos(-midAngle * RADIAN);
              const y = cy + radius * Math.sin(-midAngle * RADIAN);
              return (
                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="600">
                  {value}
                </text>
              );
            };

            return (
              <>
                {/* Team's Capacity Pie Chart with nested Team Members */}
                <div className="card" style={{ padding: '16px' }}>
                  <h3 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    marginBottom: '12px',
                    color: 'var(--accent-blue)'
                  }}>
                    Team's Capacity
                  </h3>
                  <div style={{ height: '200px', position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        {/* Outer ring - Capacity */}
                        <Pie
                          data={capacityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={showTeamMembers ? 65 : 45}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                          labelLine={false}
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            return (
                              <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
                                {(value / hoursPerDay).toFixed(0)}d
                              </text>
                            );
                          }}
                        >
                          {capacityData.map((entry, index) => (
                            <Cell key={`capacity-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        {/* Inner ring - Team Members (when expanded) */}
                        {showTeamMembers && teamMembersData.length > 0 && (
                          <Pie
                            data={teamMembersData}
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={55}
                            paddingAngle={2}
                            dataKey="value"
                            labelLine={false}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, value, percent }) => {
                              if (percent < 0.08) return null;
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="600">
                                  {value}
                                </text>
                              );
                            }}
                          >
                            {teamMembersData.map((entry, index) => (
                              <Cell key={`member-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        )}
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center clickable area for Team Members toggle */}
                    {!showTeamMembers && (
                      <div 
                        onClick={() => setShowTeamMembers(true)}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          background: 'var(--bg-tertiary)',
                          border: '2px solid var(--border-color)',
                          transition: 'all 0.2s ease'
                        }}
                        title="Click to show team breakdown"
                      >
                        <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-green)' }}>
                          {actualMembers.length}
                        </span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Members
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Capacity Legend */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {capacityData.map((entry, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: entry.color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
                        <span style={{ fontWeight: '600', color: entry.color }}>{(entry.value / hoursPerDay).toFixed(1)}d</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Utilization: <span style={{ 
                      fontWeight: '700', 
                      color: getUtilizationStatus(totals.teamUtilization) === 'danger' ? 'var(--accent-red)' : 
                             getUtilizationStatus(totals.teamUtilization) === 'warning' ? 'var(--accent-yellow)' : 'var(--accent-green)'
                    }}>{totals.teamUtilization}%</span>
                  </div>
                  
                  {/* Team Members collapsible section */}
                  <div 
                    style={{ 
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-color)'
                    }}
                  >
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                      onClick={() => setShowTeamMembers(!showTeamMembers)}
                    >
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: '600',
                        color: 'var(--accent-green)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {showTeamMembers ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Team Members
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent-green)' }}>
                        {actualMembers.length}
                      </span>
                    </div>
                    {showTeamMembers && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
                        {teamMembersData.map((entry, index) => (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color }} />
                              <span style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
                            </div>
                            <span style={{ fontWeight: '600', color: entry.color }}>{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sprint Overview Pie Chart */}
                <div className="card" style={{ padding: '16px' }}>
                  <h3 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    marginBottom: '12px',
                    color: 'var(--accent-purple)'
                  }}>
                    Sprint Overview
                  </h3>
                  {totalIssues > 0 ? (
                    <>
                      <div style={{ height: '180px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={sprintOverviewData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                              labelLine={false}
                              label={renderCustomLabel}
                            >
                              {sprintOverviewData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                        {sprintOverviewData.map((entry, index) => (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: entry.color }} />
                              <span style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
                            </div>
                            <span style={{ fontWeight: '600', color: entry.color }}>{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No issues in sprint
                    </div>
                  )}
                </div>

                {/* Leaves in Sprint - Collapsible */}
                <div className="card" style={{ padding: '16px' }}>
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                    onClick={() => setShowLeaves(!showLeaves)}
                  >
                    <h3 style={{ 
                      fontSize: '14px', 
                      fontWeight: '600',
                      color: 'var(--accent-orange)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {showLeaves ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      Leaves in Sprint
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: allLeaves.length > 0 ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
                        {allLeaves.length}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowLeavesModal(true); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '4px',
                          borderRadius: '4px',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                        title="Edit leaves"
                      >
                        <Settings size={14} />
                      </button>
                    </div>
                  </div>
                  {showLeaves && (
                    <div style={{ marginTop: '12px' }}>
                      {allLeaves.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No planned leaves</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                          {allLeaves
                            .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
                            .map((leave, index) => (
                            <div 
                              key={`${leave.memberAccountId}-${leave.id}-${index}`}
                              style={{ 
                                fontSize: '11px', 
                                padding: '6px 8px', 
                                background: leave.isUnplanned ? 'rgba(239, 68, 68, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                                borderRadius: '4px',
                                borderLeft: `3px solid ${leave.isUnplanned ? 'var(--accent-red)' : 'var(--accent-orange)'}`
                              }}
                            >
                              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{leave.memberName}</div>
                              <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {leave.isHalfDay 
                                  ? `${format(new Date(leave.startDate), 'MMM d')} - ½ day` 
                                  : `${format(new Date(leave.startDate), 'MMM d')} - ${format(new Date(leave.endDate), 'MMM d')}`}
                                {leave.reason && ` (${leave.reason})`}
                                {leave.isUnplanned && <span style={{ color: 'var(--accent-red)', fontWeight: '600' }}> [Unplanned]</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Holidays in Sprint */}
                {holidays && holidays.length > 0 && (
                  <div className="card" style={{ padding: '16px' }}>
                    <h3 style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      marginBottom: '12px',
                      color: 'var(--accent-cyan)'
                    }}>
                      Holidays
                    </h3>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {holidays.map(h => (
                        <span key={h.id} className="status-badge info" style={{ fontSize: '10px' }}>
                          {h.name} - {format(new Date(h.date), 'MMM d')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Right Column - Team Capacity Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="card-title mb-0">Team Capacity</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={expandAllMembers}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Expand all members"
              >
                <Maximize2 size={14} />
                Expand All
              </button>
              <button
                onClick={collapseAllMembers}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Collapse all members"
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
                  <th style={{ width: '250px' }} title="Team member name">Team Member</th>
                  <th className="text-center" style={{ width: '80px' }} title="Number of issues assigned to this member">Issues</th>
                  <th className="text-center" style={{ width: '120px' }} title="Available working hours after leaves and holidays, adjusted by role allocation">Availability</th>
                  <th className="text-center" style={{ width: '140px' }} title="Total committed work = Remaining estimate + Work logged during this sprint (for non-late tickets)">Work Allocated</th>
                  <th className="text-center" style={{ width: '140px' }} title="Remaining capacity = Availability - Work Allocated. Negative means overcommitted.">Available Bandwidth</th>
                  <th style={{ width: '150px' }} title="Percentage of availability that is allocated to work">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {members.map((item) => {
                  const isExpanded = expandedMembers[item.member.accountId];
                  const utilizationStatus = item.capacity ? getUtilizationStatus(item.capacity.utilizationPercent) : null;
                  const totalStoryPoints = item.work.assignedIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
                  const memberLeaves = item.availability?.leaves || [];

                  return (
                    <React.Fragment key={item.member.accountId}>
                      <tr 
                        style={{ cursor: item.work.issueCount > 0 ? 'pointer' : 'default' }}
                        onClick={() => item.work.issueCount > 0 && toggleMemberExpand(item.member.accountId)}
                      >
                        <td>
                          <div className="member-cell">
                            {item.work.issueCount > 0 && (
                              isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                            )}
                            <div className="avatar">
                              {item.member.displayName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span>{item.member.displayName}</span>
                          </div>
                        </td>
                        <td className="text-center">{item.work.issueCount}</td>
                        <td 
                          className="text-center"
                          style={{ position: 'relative' }}
                          onMouseEnter={() => memberLeaves.length > 0 && setHoveredMember(item.member.accountId)}
                          onMouseLeave={() => setHoveredMember(null)}
                        >
                          {item.availability?.availableDays !== undefined ? (
                            <div style={{ cursor: memberLeaves.length > 0 ? 'help' : 'default' }}>
                              <span style={{ fontWeight: '600' }}>
                                {item.availability.allocatedHours !== undefined 
                                  ? (item.availability.allocatedHours / hoursPerDay).toFixed(1)
                                  : (item.availability.availableHours / hoursPerDay).toFixed(1)}d
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                                ({item.availability.allocatedHours !== undefined 
                                  ? formatHours(item.availability.allocatedHours) 
                                  : formatHours(item.availability.availableHours)})
                              </span>
                              {memberLeaves.length > 0 && (
                                <span style={{ marginLeft: '4px', color: 'var(--accent-orange)', fontSize: '10px' }}>
                                  📅
                                </span>
                              )}
                              {item.availability?.roleAllocation !== 1 && item.availability?.roleAllocation !== undefined && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  {item.availability.role || 'Developer'} ({(item.availability.roleAllocation * 100).toFixed(0)}%)
                                </div>
                              )}
                            </div>
                          ) : '-'}
                          {/* Hover tooltip for leaves */}
                          {hoveredMember === item.member.accountId && memberLeaves.length > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              padding: '10px',
                              zIndex: 100,
                              minWidth: '200px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '6px', color: 'var(--accent-orange)' }}>
                                Planned Leaves
                              </div>
                              {memberLeaves.map((leave, idx) => (
                                <div key={idx} style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                  {leave.isHalfDay ? '½ day' : `${format(new Date(leave.startDate), 'MMM d')} - ${format(new Date(leave.endDate), 'MMM d')}`}
                                  {leave.reason && ` (${leave.reason})`}
                                  {leave.isUnplanned && <span style={{ color: 'var(--accent-red)' }}> [Unplanned]</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="text-center">
                          {(item.work.totalCommittedHours ?? item.work.totalEstimatedHours) > 0 ? (
                            <div>
                              <span style={{ fontWeight: '600' }}>
                                {((item.work.totalCommittedHours ?? item.work.totalEstimatedHours) / hoursPerDay).toFixed(1)}d
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                                ({formatHours(item.work.totalCommittedHours ?? item.work.totalEstimatedHours)})
                              </span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="text-center">
                          {item.capacity ? (
                            <div className={item.capacity.remainingCapacity < 0 ? 'status-badge danger' : ''}>
                              <span style={{ fontWeight: '600' }}>
                                {(item.capacity.remainingCapacity / hoursPerDay).toFixed(1)}d
                              </span>
                              <span style={{ fontSize: '11px', color: item.capacity.remainingCapacity < 0 ? 'inherit' : 'var(--text-muted)', marginLeft: '4px' }}>
                                ({formatHours(item.capacity.remainingCapacity)})
                              </span>
                            </div>
                          ) : '-'}
                        </td>
                        <td>
                          {item.capacity && (
                            <div>
                              <div className="progress-bar" style={{ marginBottom: '4px' }}>
                                <div 
                                  className={`progress-bar-fill ${utilizationStatus}`}
                                  style={{ width: `${Math.min(item.capacity.utilizationPercent, 100)}%` }}
                                />
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {item.capacity.utilizationPercent}%
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded && item.work.assignedIssues.length > 0 && (
                        <tr>
                          <td colSpan="6" style={{ padding: '0 12px 12px 24px', background: 'var(--bg-secondary)' }}>
                            <table className="planning-table" style={{ marginTop: '8px', fontSize: '12px' }}>
                              <thead>
                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                  <th style={{ padding: '6px 8px' }} title="Jira issue key">Key</th>
                                  <th style={{ padding: '6px 8px' }} title="Issue type (Story, Bug, Task, etc.)">Type</th>
                                  <th style={{ padding: '6px 8px' }} title="Issue title/description">Summary</th>
                                  <th style={{ padding: '6px 8px' }} className="text-center" title="Current workflow status">Status</th>
                                  <th style={{ padding: '6px 8px' }} className="text-center" title="Committed effort = Remaining estimate + Work logged during this sprint">Work Allocated</th>
                                  <th style={{ padding: '6px 8px' }} className="text-center" title="Time logged during this sprint only">Work Logged</th>
                                  <th style={{ padding: '6px 8px' }} className="text-center" title="Remaining time estimate from Jira">Remaining Est.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.work.assignedIssues.filter(issue => !issue.isCompletedBeforeSprint).map(issue => {
                                  // Calculate committed effort for this task (remaining + work logged in sprint)
                                  // All tickets (including late additions) count remaining + logged work
                                  const workLoggedInSprint = issue.workLogged || 0;
                                  const remainingEst = issue.remainingEstimate || 0;
                                  const committedEffort = remainingEst + workLoggedInSprint;
                                  
                                  return (
                                    <tr key={issue.key}>
                                      <td style={{ padding: '6px 8px' }}>
                                        <a href={getJiraLink(jiraBaseUrl, issue.key)} target="_blank" rel="noopener noreferrer" className="issue-key" style={{ textDecoration: 'none', fontSize: '11px' }}>
                                          {issue.key} <ExternalLink size={9} />
                                        </a>
                                        {issue.isLateAddition && (
                                          <span className="status-badge" style={{ fontSize: '9px', backgroundColor: 'var(--accent-yellow)', color: '#000', marginLeft: '4px' }}>Late</span>
                                        )}
                                      </td>
                                      <td style={{ padding: '6px 8px' }}>
                                        <span className={`status-badge ${issue.issueType === 'Bug' ? 'danger' : 'info'}`} style={{ fontSize: '10px' }}>
                                          {issue.issueType}
                                        </span>
                                      </td>
                                      <td style={{ padding: '6px 8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <a href={getJiraLink(jiraBaseUrl, issue.key)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                                          {issue.summary}
                                        </a>
                                      </td>
                                      <td style={{ padding: '6px 8px' }} className="text-center">
                                        <span className={`status-badge ${issue.isCompleted ? 'success' : 'info'}`} style={{ fontSize: '10px' }}>
                                          {issue.status}
                                        </span>
                                      </td>
                                      <td style={{ padding: '6px 8px', fontWeight: '600' }} className="text-center">
                                        {committedEffort > 0 ? (
                                          <span>
                                            {(committedEffort / hoursPerDay).toFixed(1)}d
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '2px' }}>
                                              ({formatHours(committedEffort)})
                                            </span>
                                          </span>
                                        ) : '-'}
                                      </td>
                                      <td style={{ padding: '6px 8px', color: 'var(--accent-green)' }} className="text-center">
                                        {workLoggedInSprint > 0 ? formatHours(workLoggedInSprint) : '-'}
                                      </td>
                                      <td style={{ padding: '6px 8px' }} className="text-center">
                                        {remainingEst > 0 ? formatHours(remainingEst) : '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {/* Totals Row */}
                <tr style={{ background: 'var(--bg-secondary)', fontWeight: '600' }}>
                  <td>TOTAL</td>
                  <td className="text-center">{planning.members.reduce((sum, m) => sum + (m.work?.issueCount || 0), 0)}</td>
                  <td className="text-center">
                    <span style={{ fontWeight: '600' }}>
                      {(totals.totalTeamCapacity / hoursPerDay).toFixed(1)}d
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                      ({formatHours(totals.totalTeamCapacity)})
                    </span>
                  </td>
                  <td className="text-center">
                    {totals.totalCommitted > 0 ? (
                      <div>
                        <span style={{ fontWeight: '600' }}>
                          {(totals.totalCommitted / hoursPerDay).toFixed(1)}d
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                          ({formatHours(totals.totalCommitted)})
                        </span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="text-center">
                    <div className={totals.totalRemaining < 0 ? 'status-badge danger' : ''}>
                      <span style={{ fontWeight: '600' }}>
                        {(totals.totalRemaining / hoursPerDay).toFixed(1)}d
                      </span>
                      <span style={{ fontSize: '11px', color: totals.totalRemaining < 0 ? 'inherit' : 'var(--text-muted)', marginLeft: '4px' }}>
                        ({formatHours(totals.totalRemaining)})
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${getUtilizationStatus(totals.teamUtilization)}`}>
                      {totals.teamUtilization}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tech Stories Section */}
      {(() => {
        // Filter out issues completed before sprint start
        const filterIssues = (issues) => issues.filter(issue => !issue.isCompletedBeforeSprint);
        
        const allIssues = members.flatMap(m => filterIssues(m.work.assignedIssues));
        const techStoriesRaw = allIssues.filter(i => 
          i.issueType === 'Story' || i.issueType === 'Task' || i.issueType === 'Technical Task'
        );
        const subtasks = allIssues.filter(i => i.isSubtask);
        
        // Group subtasks by parent
        const subtasksByParent = {};
        subtasks.forEach(st => {
          if (st.parentKey) {
            if (!subtasksByParent[st.parentKey]) subtasksByParent[st.parentKey] = [];
            subtasksByParent[st.parentKey].push(st);
          }
        });
        
        if (techStoriesRaw.length === 0) return null;
        
        const getAssigneeName = (issue) => members.find(m => m.work.assignedIssues.some(i => i.key === issue.key))?.member.displayName || '';
        
        return (
          <IssuesTable
            title="Tech Stories"
            issues={techStoriesRaw}
            subtasksByParent={subtasksByParent}
            type="techStories"
            hoursPerDay={hoursPerDay}
            showStoryPoints={true}
            getAssigneeName={getAssigneeName}
            jiraBaseUrl={jiraBaseUrl}
          />
        );
      })()}

      {/* Production Issues / Bugs Section */}
      {(() => {
        // Filter out issues completed before sprint start
        const filterIssues = (issues) => issues.filter(issue => !issue.isCompletedBeforeSprint);
        
        const allIssues = members.flatMap(m => filterIssues(m.work.assignedIssues));
        const productionIssuesRaw = allIssues.filter(i => 
          (i.issueType === 'Bug' || i.issueType === 'Incident' || i.issueType === 'Production Issue') && !i.isSubtask
        );
        const bugSubtasks = allIssues.filter(i => i.isSubtask && productionIssuesRaw.some(p => p.key === i.parentKey));
        
        // Group subtasks by parent bug
        const subtasksByParent = {};
        bugSubtasks.forEach(st => {
          if (st.parentKey) {
            if (!subtasksByParent[st.parentKey]) subtasksByParent[st.parentKey] = [];
            subtasksByParent[st.parentKey].push(st);
          }
        });
        
        if (productionIssuesRaw.length === 0) return null;
        
        const getAssigneeName = (issue) => members.find(m => m.work.assignedIssues.some(i => i.key === issue.key))?.member.displayName || '';
        
        return (
          <IssuesTable
            title="Production Issues / Bugs"
            issues={productionIssuesRaw}
            subtasksByParent={subtasksByParent}
            type="productionIssues"
            hoursPerDay={hoursPerDay}
            getAssigneeName={getAssigneeName}
            jiraBaseUrl={jiraBaseUrl}
          />
        );
      })()}
    </div>
    <LeavesModal
        isOpen={showLeavesModal}
        onClose={() => setShowLeavesModal(false)}
        onLeavesChanged={onRefresh}
      />
    </>
  );
}

export default SprintPlanning;
