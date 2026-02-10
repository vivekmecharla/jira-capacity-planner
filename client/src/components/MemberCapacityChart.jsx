import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

/**
 * Reusable component that displays a collapsible section with per-member
 * bar charts showing Available Hours, Work Allocated, and Work Logged.
 *
 * Props:
 *   - title: Section title
 *   - members: Array of { name, availableHours, workAllocated, workLogged }
 *   - hoursPerDay: Number (for day conversion display)
 *   - defaultExpanded: Whether the whole section starts expanded (default false)
 */
function MemberCapacityChart({ title = 'Member Capacity', members = [], hoursPerDay = 8, defaultExpanded = false }) {
  const [sectionExpanded, setSectionExpanded] = useState(defaultExpanded);
  const [expandedMembers, setExpandedMembers] = useState({});
  const [activeView, setActiveView] = useState('summary'); // 'summary' or 'individual'

  if (!members || members.length === 0) return null;

  const toggleMember = (name) => {
    setExpandedMembers(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const expandAll = () => {
    const all = {};
    members.forEach(m => { all[m.name] = true; });
    setExpandedMembers(all);
  };

  const collapseAll = () => {
    setExpandedMembers({});
  };

  const COLORS = {
    available: '#3b82f6',
    allocated: '#a855f7',
    logged: '#22c55e'
  };

  const formatVal = (hours) => {
    if (!hours && hours !== 0) return '0h';
    return `${(hours).toFixed(1)}h`;
  };

  const formatDays = (hours) => {
    if (!hours && hours !== 0) return '0d';
    return `${(hours / hoursPerDay).toFixed(1)}d`;
  };

  // Summary bar chart data (all members combined)
  const summaryData = [
    { name: 'Available', value: members.reduce((s, m) => s + (m.availableHours || 0), 0), color: COLORS.available },
    { name: 'Allocated', value: members.reduce((s, m) => s + (m.workAllocated || 0), 0), color: COLORS.allocated },
    { name: 'Logged', value: members.reduce((s, m) => s + (m.workLogged || 0), 0), color: COLORS.logged }
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: '600', color: d.color || 'var(--text-primary)' }}>{d.name}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{formatVal(d.value)} ({formatDays(d.value)})</div>
        </div>
      );
    }
    return null;
  };

  const MemberTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '12px'
        }}>
          {payload.map((p, i) => (
            <div key={i} style={{ color: p.color, fontWeight: '500', marginBottom: i < payload.length - 1 ? '4px' : 0 }}>
              {p.name}: {formatVal(p.value)} ({formatDays(p.value)})
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Per-member grouped bar data
  const memberBarData = members.map(m => ({
    name: m.name.length > 15 ? m.name.substring(0, 14) + '…' : m.name,
    fullName: m.name,
    Available: m.availableHours || 0,
    Allocated: m.workAllocated || 0,
    Logged: m.workLogged || 0
  }));

  return (
    <div className="card mb-4">
      {/* Section Header - Collapsible */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '4px 0'
        }}
        onClick={() => setSectionExpanded(!sectionExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {sectionExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <h3 className="card-title" style={{ margin: 0 }}>
            {title} ({members.length} members)
          </h3>
        </div>
      </div>

      {sectionExpanded && (
        <div style={{ marginTop: '16px' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <button
              onClick={() => setActiveView('summary')}
              className={`btn ${activeView === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Team Summary
            </button>
            <button
              onClick={() => setActiveView('individual')}
              className={`btn ${activeView === 'individual' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Individual Breakdown
            </button>
          </div>

          {/* Team Summary View */}
          {activeView === 'summary' && (
            <>
              {/* Team Summary Stats */}
              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Team Summary
                </div>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  {summaryData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: d.color }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{d.name}:</span>
                      <span style={{ fontWeight: '700', color: d.color }}>{formatDays(d.value)}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({formatVal(d.value)})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vertical Team Summary Chart */}
              <div style={{ height: '600px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={memberBarData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--border-color)' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      type="number"
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      axisLine={{ stroke: 'var(--border-color)' }}
                      tickFormatter={(v) => `${(v / hoursPerDay).toFixed(0)}d`}
                    />
                    <Tooltip content={<MemberTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                      iconType="square"
                      iconSize={10}
                    />
                    <Bar dataKey="Available" fill={COLORS.available} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Allocated" fill={COLORS.allocated} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Logged" fill={COLORS.logged} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Individual Breakdown View */}
          {activeView === 'individual' && (
            <>
              {/* Per-Member Expandable Details */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    Individual Breakdown
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); expandAll(); }}
                      className="btn btn-secondary"
                      style={{ fontSize: '11px', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Maximize2 size={12} /> Expand All
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); collapseAll(); }}
                      className="btn btn-secondary"
                      style={{ fontSize: '11px', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Minimize2 size={12} /> Collapse All
                    </button>
                  </div>
                </div>

                {members.map(member => {
                  const isExpanded = expandedMembers[member.name];
                  const barData = [
                    { name: 'Available', value: member.availableHours || 0, color: COLORS.available },
                    { name: 'Allocated', value: member.workAllocated || 0, color: COLORS.allocated },
                    { name: 'Logged', value: member.workLogged || 0, color: COLORS.logged }
                  ];
                  const loggedPercent = member.workAllocated > 0
                    ? Math.round((member.workLogged / member.workAllocated) * 100)
                    : 0;

                  return (
                    <div
                      key={member.name}
                      style={{
                        marginBottom: '4px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Member Header */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          background: isExpanded ? 'rgba(59, 130, 246, 0.06)' : 'var(--bg-secondary)',
                          transition: 'background 0.15s ease'
                        }}
                        onClick={() => toggleMember(member.name)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '11px', lineHeight: '24px' }}>
                            {member.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {member.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '11px' }}>
                          <span style={{ color: COLORS.available }}>
                            <strong>{formatDays(member.availableHours)}</strong> avail
                          </span>
                          <span style={{ color: COLORS.allocated }}>
                            <strong>{formatDays(member.workAllocated)}</strong> alloc
                          </span>
                          <span style={{ color: COLORS.logged }}>
                            <strong>{formatDays(member.workLogged)}</strong> logged
                          </span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: loggedPercent >= 100 ? 'rgba(34, 197, 94, 0.15)' : loggedPercent >= 80 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: loggedPercent >= 100 ? 'var(--accent-green)' : loggedPercent >= 80 ? 'var(--accent-yellow)' : 'var(--accent-red)'
                          }}>
                            {loggedPercent}% logged
                          </span>
                        </div>
                      </div>

                      {/* Expanded: Individual Bar Chart */}
                      {isExpanded && (
                        <div style={{ padding: '12px 16px', background: 'var(--bg-primary)' }}>
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            {/* Bar Chart */}
                            <div style={{ flex: 1, height: '100px' }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 20, left: 5, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                                  <XAxis
                                    type="number"
                                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                                    axisLine={{ stroke: 'var(--border-color)' }}
                                    tickFormatter={(v) => `${(v / hoursPerDay).toFixed(0)}d`}
                                  />
                                  <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                                    axisLine={{ stroke: 'var(--border-color)' }}
                                    width={65}
                                  />
                                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                                    {barData.map((entry, idx) => (
                                      <Cell key={idx} fill={entry.color} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Stats */}
                            <div style={{ minWidth: '160px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Available:</span>
                                <span style={{ fontWeight: '600', color: COLORS.available }}>{formatVal(member.availableHours)} ({formatDays(member.availableHours)})</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Allocated:</span>
                                <span style={{ fontWeight: '600', color: COLORS.allocated }}>{formatVal(member.workAllocated)} ({formatDays(member.workAllocated)})</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Logged:</span>
                                <span style={{ fontWeight: '600', color: COLORS.logged }}>{formatVal(member.workLogged)} ({formatDays(member.workLogged)})</span>
                              </div>
                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Logged vs Allocated:</span>
                                <span style={{
                                  fontWeight: '700',
                                  color: loggedPercent >= 100 ? 'var(--accent-green)' : loggedPercent >= 80 ? 'var(--accent-yellow)' : 'var(--accent-red)'
                                }}>{loggedPercent}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default MemberCapacityChart;
