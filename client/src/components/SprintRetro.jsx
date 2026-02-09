import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, XCircle, AlertCircle, ChevronDown, ChevronUp, ChevronRight, Filter, X, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { jiraApi, configApi } from '../api';
import IssuesTable from './IssuesTable';
import MemberIssuesTable from './MemberIssuesTable';
import LeavesModal from './LeavesModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';

function SprintRetro({ sprint, selectedBoard, jiraBaseUrl = '', boardId = null }) {
  const [retroData, setRetroData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Sort and filter state for All Issues table (kept since it's not using IssuesTable)
  const [allSort, setAllSort] = useState({ column: null, direction: 'asc' });
  const [allFilter, setAllFilter] = useState('');
  const [showAllFilter, setShowAllFilter] = useState(false);
  
  // State for expandable pie charts
  const [showTicketsBreakdown, setShowTicketsBreakdown] = useState(false);
  
  // State for collapsible All Sprint Issues section
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [showLeavesModal, setShowLeavesModal] = useState(false);

  useEffect(() => {
    if (sprint?.id) {
      loadRetroData(sprint.id);
    }
  }, [sprint, boardId]);

  const loadRetroData = async (sprintId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await jiraApi.getSprintRetro(sprintId, boardId);
      setRetroData(response.data);
    } catch (err) {
      setError('Failed to load retrospective data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading retrospective data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="empty-state">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!retroData || !retroData.summary) {
    return (
      <div className="card">
        <div className="empty-state">
          <p>Select a sprint to view retrospective data</p>
        </div>
      </div>
    );
  }

  const { 
    sprint: sprintInfo, 
    issues = [], 
    summary = {}, 
    techStories = [], 
    productionIssues = [], 
    subtasksByParent = {}, 
    hoursPerDay = 7 
  } = retroData;

  // Filter out issues completed before sprint start
  const filterIssues = (issues) => issues.filter(issue => !issue.isCompletedBeforeSprint);
  
  const filteredIssues = filterIssues(issues);
  const filteredTechStories = filterIssues(techStories);
  const filteredProductionIssues = filterIssues(productionIssues);
  const filteredSubtasksByParent = {};
  Object.keys(subtasksByParent).forEach(parentKey => {
    filteredSubtasksByParent[parentKey] = filterIssues(subtasksByParent[parentKey]);
  });

  const getStatusIcon = (issue) => {
    // Use isCompleted flag from backend if available
    if (issue.isCompleted) {
      return <CheckCircle size={16} className="text-success" />;
    }
    const statusLower = issue.status?.toLowerCase() || '';
    if (statusLower.includes('progress')) {
      return <Clock size={16} className="text-warning" />;
    } else if (statusLower.includes('blocked')) {
      return <XCircle size={16} className="text-danger" />;
    }
    return <AlertCircle size={16} className="text-muted" />;
  };

  const formatHours = (hours) => {
    if (!hours && hours !== 0) return '-';
    return `${Math.round(hours * 10) / 10}h`;
  };

  const getDelayReason = (issue) => {
    if (!issue.dueDate) return null;
    const dueDate = new Date(issue.dueDate);
    const now = new Date();
    
    // Use isCompleted flag from backend
    if (!issue.isCompleted && dueDate < now) {
      const daysOverdue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));
      return `${daysOverdue} days overdue`;
    }
    return null;
  };

  const techStats = summary.techStories || {};
  const prodStats = summary.productionIssues || {};

  // Chart colors
  const COLORS = {
    completed: '#22c55e',
    incomplete: '#ef4444',
    committed: '#3b82f6',
    added: '#eab308',
    techStories: '#3b82f6',
    productionIssues: '#ef4444'
  };

  // Calculate total story points (committed + added mid-sprint)
  const totalStoryPoints = (techStats.committedStoryPoints || 0) + (techStats.midSprintAdditions || 0);
  const pendingStoryPoints = Math.max(0, totalStoryPoints - (techStats.completedStoryPoints || 0));
  
  // Calculate total tickets
  const totalTickets = (techStats.totalTicketsAtEnd || 0) + (prodStats.totalTicketsAtEnd || 0);
  const committedTickets = (techStats.committedTickets || 0) + (prodStats.committedTickets || 0);
  const completedTickets = (techStats.completedTickets || 0) + (prodStats.completedTickets || 0);
  const addedMidSprintTickets = (techStats.midSprintAdditions || 0) + (prodStats.midSprintAdditions || 0);
  const pendingTickets = (techStats.incompleteTickets || 0) + (prodStats.incompleteTickets || 0);

  // Prepare bar chart data for Story Points
  const storyPointsBarData = [
    { name: 'Total', value: totalStoryPoints, color: 'var(--text-secondary)', fill: 'var(--text-muted)' },
    { name: 'Committed', value: techStats.committedStoryPoints || 0, color: COLORS.committed, fill: COLORS.committed },
    { name: 'Completed', value: techStats.completedStoryPoints || 0, color: COLORS.completed, fill: COLORS.completed },
    { name: 'Added Mid-Sprint', value: techStats.midSprintAdditions || 0, color: COLORS.added, fill: COLORS.added },
    { name: 'Pending', value: pendingStoryPoints, color: COLORS.incomplete, fill: COLORS.incomplete }
  ];

  // Prepare bar chart data for Tickets (combined or split by category)
  const ticketsBarData = showTicketsBreakdown ? [
    { name: 'Total', value: totalTickets, color: 'var(--text-muted)', fill: 'var(--text-muted)' },
    { name: 'Tech Committed', value: techStats.committedTickets || 0, color: COLORS.techStories, fill: COLORS.techStories },
    { name: 'Tech Completed', value: techStats.completedTickets || 0, color: '#22c55e', fill: '#22c55e' },
    { name: 'Tech Added', value: techStats.midSprintAdditions || 0, color: '#eab308', fill: '#eab308' },
    { name: 'Tech Pending', value: techStats.incompleteTickets || 0, color: '#f97316', fill: '#f97316' },
    { name: 'Prod Committed', value: prodStats.committedTickets || 0, color: '#dc2626', fill: '#dc2626' },
    { name: 'Prod Completed', value: prodStats.completedTickets || 0, color: '#16a34a', fill: '#16a34a' },
    { name: 'Prod Added', value: prodStats.midSprintAdditions || 0, color: '#ca8a04', fill: '#ca8a04' },
    { name: 'Prod Pending', value: prodStats.incompleteTickets || 0, color: '#ef4444', fill: '#ef4444' }
  ] : [
    { name: 'Total', value: totalTickets, color: 'var(--text-muted)', fill: 'var(--text-muted)' },
    { name: 'Committed', value: committedTickets, color: COLORS.committed, fill: COLORS.committed },
    { name: 'Completed', value: completedTickets, color: COLORS.completed, fill: COLORS.completed },
    { name: 'Added Mid-Sprint', value: addedMidSprintTickets, color: COLORS.added, fill: COLORS.added },
    { name: 'Pending', value: pendingTickets, color: COLORS.incomplete, fill: COLORS.incomplete }
  ];

  // Ticket categories pie chart data
  const ticketsCategoryData = [
    { name: 'Tech Stories', value: techStats.totalTicketsAtEnd || 0, color: COLORS.techStories },
    { name: 'Production Issues', value: prodStats.totalTicketsAtEnd || 0, color: COLORS.productionIssues }
  ].filter(d => d.value > 0);

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '12px'
        }}>
          <div style={{ color: data.fill || data.color, fontWeight: '600' }}>{data.name}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{data.value}</div>
        </div>
      );
    }
    return null;
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
  const SortHeader = ({ label, column, sort, onSort, className = '', tooltip = '' }) => (
    <th 
      className={className}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSort(column)}
      title={tooltip}
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
  const FilterToolbar = ({ show, setShow, filter, setFilter, placeholder = 'Filter...' }) => (
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

  // Filter and sort all issues
  const filteredAllIssues = allFilter 
    ? filteredIssues.filter(i => 
        i.key.toLowerCase().includes(allFilter.toLowerCase()) ||
        i.summary.toLowerCase().includes(allFilter.toLowerCase()) ||
        (i.status || '').toLowerCase().includes(allFilter.toLowerCase()) ||
        (i.issueType || '').toLowerCase().includes(allFilter.toLowerCase()) ||
        (i.assignee || '').toLowerCase().includes(allFilter.toLowerCase())
      )
    : filteredIssues;
  
  const getAllValue = (item, col) => {
    switch(col) {
      case 'key': return item.key;
      case 'issueType': return item.issueType || '';
      case 'summary': return item.summary;
      case 'status': return item.status;
      case 'assignee': return item.assignee || '';
      case 'dueDate': return item.dueDate ? new Date(item.dueDate).getTime() : 0;
      default: return item[col];
    }
  };
  const sortedAllIssues = sortData(filteredAllIssues, allSort, getAllValue);

  return (
    <div>
      {/* Header with Sprint Info and Manage Leaves Button */}
      <div className="card mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>{sprintInfo?.name || 'Sprint Retrospective'}</h2>
        <button
          className="btn btn-secondary"
          onClick={() => setShowLeavesModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Settings size={14} />
          Manage Leaves
        </button>
      </div>

      {/* Charts Row - Bar Charts for Story Points and Tickets, Pie Chart for Categories */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Story Points Bar Chart */}
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--accent-purple)' }}>
            Story Points
          </h3>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={storyPointsBarData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-color)' }} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} 
                  axisLine={{ stroke: 'var(--border-color)' }}
                  width={75}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {storyPointsBarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="value" position="right" fill="var(--text-secondary)" fontSize={11} fontWeight="600" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Completion Rate</span>
            <span style={{ fontWeight: '700', color: 'var(--accent-purple)' }}>{techStats.completionRate || 0}%</span>
          </div>
        </div>

        {/* Tickets Bar Chart - Clickable to expand */}
        <div className="card" style={{ padding: '16px' }}>
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
            onClick={() => setShowTicketsBreakdown(!showTicketsBreakdown)}
          >
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {showTicketsBreakdown ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Tickets
            </h3>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {showTicketsBreakdown ? 'Tech Stories & Prod Issues' : 'Click to expand by category'}
            </span>
          </div>
          <div style={{ height: showTicketsBreakdown ? '320px' : '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ticketsBarData} layout="vertical" margin={{ top: 5, right: 30, left: showTicketsBreakdown ? 95 : 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-color)' }} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} 
                  axisLine={{ stroke: 'var(--border-color)' }}
                  width={showTicketsBreakdown ? 90 : 75}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {ticketsBarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="value" position="right" fill="var(--text-secondary)" fontSize={11} fontWeight="600" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ticket Categories Pie Chart - Smaller */}
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--accent-orange)' }}>
            Categories
          </h3>
          {ticketsCategoryData.length > 0 ? (
            <>
              <div style={{ height: '120px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ticketsCategoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={45}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
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
                      {ticketsCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                {ticketsCategoryData.map((entry, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
                    </div>
                    <span style={{ fontWeight: '600', color: entry.color }}>{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
              No data
            </div>
          )}
        </div>
      </div>

      {/* Tech Stories Section */}
      {filteredTechStories.length > 0 && (
        <IssuesTable
          title="Tech Stories"
          issues={filteredTechStories}
          subtasksByParent={filteredSubtasksByParent}
          type="techStories"
          hoursPerDay={hoursPerDay}
          showDueDate={true}
          showDelay={true}
          jiraBaseUrl={jiraBaseUrl}
        />
      )}
      {filteredTechStories.length === 0 && (
        <div className="card mb-4">
          <h3 className="card-title">Tech Stories (0)</h3>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No tech stories in this sprint</div>
        </div>
      )}

      {/* Production Issues Section */}
      {filteredProductionIssues.length > 0 && (
        <IssuesTable
          title="Production Issues / Bugs"
          issues={filteredProductionIssues}
          subtasksByParent={filteredSubtasksByParent}
          type="productionIssues"
          hoursPerDay={hoursPerDay}
          showDueDate={true}
          showDelay={true}
          jiraBaseUrl={jiraBaseUrl}
        />
      )}
      {filteredProductionIssues.length === 0 && (
        <div className="card mb-4">
          <h3 className="card-title">Production Issues / Bugs (0)</h3>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No production issues in this sprint</div>
        </div>
      )}

      {/* Member-wise Issues Section */}
      {filteredIssues.length > 0 && (
        <MemberIssuesTable
          title="Member-wise Breakdown"
          issues={[...filteredTechStories, ...filteredProductionIssues]}
          subtasksByParent={filteredSubtasksByParent}
          hoursPerDay={hoursPerDay}
          showDueDate={true}
          showDelay={true}
          jiraBaseUrl={jiraBaseUrl}
        />
      )}

      {/* All Issues with Late Additions Highlighted - Collapsible */}
      <div className="card">
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: showAllIssues ? '16px' : '0',
            cursor: 'pointer',
            padding: '8px 0'
          }}
          onClick={() => setShowAllIssues(!showAllIssues)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="card-title" style={{ margin: 0 }}>
              All Sprint Issues ({filteredIssues.length}){allFilter && ` - showing ${sortedAllIssues.length}`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {showAllIssues ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
        
        {showAllIssues && (
          <>
            <FilterToolbar 
              show={showAllFilter} 
              setShow={setShowAllFilter} 
              filter={allFilter} 
              setFilter={setAllFilter}
              placeholder="Filter by key, type, status..."
            />
            <div style={{ overflowX: 'auto' }}>
          <table className="planning-table">
            <thead>
              <tr>
                <SortHeader label="Key" column="key" sort={allSort} onSort={(col) => handleSort(allSort, setAllSort, col)} tooltip="Jira issue key" />
                <SortHeader label="Type" column="issueType" sort={allSort} onSort={(col) => handleSort(allSort, setAllSort, col)} tooltip="Issue type (Story, Bug, Task, etc.)" />
                <SortHeader label="Summary" column="summary" sort={allSort} onSort={(col) => handleSort(allSort, setAllSort, col)} tooltip="Issue title/description" />
                <SortHeader label="Status" column="status" sort={allSort} onSort={(col) => handleSort(allSort, setAllSort, col)} className="text-center" tooltip="Current workflow status" />
                <SortHeader label="Assignee" column="assignee" sort={allSort} onSort={(col) => handleSort(allSort, setAllSort, col)} className="text-center" tooltip="Team member assigned to this issue" />
                <SortHeader label="Due Date" column="dueDate" sort={allSort} onSort={(col) => handleSort(allSort, setAllSort, col)} className="text-center" tooltip="Target completion date" />
                <th className="text-center" title="Days overdue past due date">Delay Reason</th>
              </tr>
            </thead>
            <tbody>
              {sortedAllIssues.map(issue => {
                const delayReason = getDelayReason(issue);
                return (
                  <tr 
                    key={issue.key}
                    style={issue.isLateAddition ? { backgroundColor: 'rgba(255, 193, 7, 0.15)' } : {}}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="issue-key">{issue.key}</span>
                        {issue.isLateAddition && (
                          <AlertTriangle size={14} style={{ color: 'var(--accent-yellow)' }} />
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${issue.issueType === 'Bug' ? 'danger' : 'info'}`}>
                        {issue.issueType}
                      </span>
                    </td>
                    <td>{issue.summary}</td>
                    <td className="text-center">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        {getStatusIcon(issue)}
                        <span className={`status-badge ${issue.isCompleted ? 'success' : 'info'}`}>{issue.status}</span>
                      </div>
                    </td>
                    <td className="text-center">{issue.assignee || '-'}</td>
                    <td className="text-center">
                      {issue.dueDate ? format(new Date(issue.dueDate), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="text-center">
                      {delayReason && (
                        <span className="status-badge danger">{delayReason}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
          </>
        )}
      </div>

      <LeavesModal
        isOpen={showLeavesModal}
        onClose={() => setShowLeavesModal(false)}
        onLeavesChanged={async () => {
          try {
            await configApi.getLeaves();
          } catch (err) {
            console.error('Failed to refresh leaves:', err);
          }
        }}
      />
    </div>
  );
}

export default SprintRetro;
