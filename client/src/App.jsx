import React, { useState, useEffect } from 'react';
import { Settings, Users, Calendar, BarChart3, RefreshCw, ClipboardList, History, Sun, Moon, GitBranch, MessageSquare } from 'lucide-react';
import { jiraApi, capacityApi } from './api';
import SprintPlanning from './components/SprintPlanning.jsx';
import SprintRetro from './components/SprintRetro.jsx';
import TeamConfig from './components/TeamConfig.jsx';
import HolidaysLeaves from './components/HolidaysLeaves.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import TeamTimeline from './components/TeamTimeline.jsx';
import Standup from './components/Standup.jsx';

function App() {
  const [activeTab, setActiveTab] = useState('planning');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [planningData, setPlanningData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [includeClosedSprints, setIncludeClosedSprints] = useState(false);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'dark';
  });
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadBoards(selectedProject.key);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedBoard) {
      loadSprints(selectedBoard.id, includeClosedSprints);
    }
  }, [selectedBoard, includeClosedSprints]);

  useEffect(() => {
    if (selectedSprint) {
      loadPlanningData(selectedSprint.id);
    }
  }, [selectedSprint, selectedBoard]);

  const checkConnection = async () => {
    try {
      await jiraApi.getCurrentUser();
      setConnectionStatus('connected');
      // Fetch Jira base URL for links
      try {
        const baseUrlResponse = await jiraApi.getBaseUrl();
        setJiraBaseUrl(baseUrlResponse.data.baseUrl || '');
      } catch (e) {
        console.warn('Could not fetch Jira base URL');
      }
      loadProjects();
    } catch (err) {
      setConnectionStatus('error');
      setError('Failed to connect to Jira. Please check your configuration.');
    }
  };

  const loadProjects = async () => {
    try {
      const response = await jiraApi.getProjects();
      setProjects(response.data);
      // Default to "Core Product Initiatives" project if available
      const defaultProject = response.data.find(p => p.name === 'Core Product Initiatives');
      if (defaultProject) {
        setSelectedProject(defaultProject);
      } else if (response.data.length > 0) {
        setSelectedProject(response.data[0]);
      }
    } catch (err) {
      setError('Failed to load projects');
    }
  };

  const loadBoards = async (projectKey = null) => {
    try {
      const response = await jiraApi.getBoards(projectKey);
      setBoards(response.data);
      if (response.data.length > 0) {
        setSelectedBoard(response.data[0]);
      } else {
        setSelectedBoard(null);
        setSprints([]);
        setSelectedSprint(null);
      }
    } catch (err) {
      setError('Failed to load boards');
    }
  };

  const loadSprints = async (boardId, includeClosed = false) => {
    try {
      const state = includeClosed ? 'active,future,closed' : 'active,future';
      const response = await jiraApi.getSprints(boardId, state);
      
      // Sort sprints: active first, then future, then closed (most recent first)
      const sortedSprints = response.data.sort((a, b) => {
        const stateOrder = { active: 0, future: 1, closed: 2 };
        if (stateOrder[a.state] !== stateOrder[b.state]) {
          return stateOrder[a.state] - stateOrder[b.state];
        }
        // For closed sprints, sort by end date descending (most recent first)
        if (a.state === 'closed' && b.state === 'closed') {
          return new Date(b.endDate) - new Date(a.endDate);
        }
        return 0;
      });
      
      setSprints(sortedSprints);
      
      // Only auto-select if no sprint is currently selected or current sprint is not in list
      if (!selectedSprint || !sortedSprints.find(s => s.id === selectedSprint.id)) {
        const activeSprint = sortedSprints.find(s => s.state === 'active');
        if (activeSprint) {
          setSelectedSprint(activeSprint);
        } else if (sortedSprints.length > 0) {
          setSelectedSprint(sortedSprints[0]);
        }
      }
    } catch (err) {
      setError('Failed to load sprints');
    }
  };

  const loadPlanningData = async (sprintId) => {
    setLoading(true);
    setError(null);
    setPlanningData(null); // Clear old data to prevent stale data issues
    try {
      const response = await capacityApi.getSprintPlanning(sprintId, selectedBoard?.id || null);
      setPlanningData(response.data);
    } catch (err) {
      setError('Failed to load planning data. Make sure team members are configured.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (selectedSprint) {
      loadPlanningData(selectedSprint.id);
    }
  };

  const renderContent = () => {
    // Check if current sprint is appropriate for the selected tab
    if (selectedSprint) {
      if (activeTab === 'retro' && selectedSprint.state === 'future') {
        return (
          <div className="card">
            <div className="empty-state">
              <p>Sprint Retro is only available for active and closed sprints.</p>
              <p className="mt-4" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Current sprint: {selectedSprint.name} ({selectedSprint.state})
              </p>
              <p className="mt-2" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Please select an active or closed sprint from the dropdown above.
              </p>
            </div>
          </div>
        );
      }
    }
    
    switch (activeTab) {
      case 'planning':
        return (
          <SprintPlanning
            planningData={planningData}
            loading={loading}
            error={error}
            sprint={selectedSprint}
            onRefresh={handleRefresh}
            jiraBaseUrl={jiraBaseUrl}
          />
        );
      case 'retro':
        return (
          <SprintRetro
            sprint={selectedSprint}
            selectedBoard={selectedBoard}
            jiraBaseUrl={jiraBaseUrl}
            boardId={selectedBoard?.id}
          />
        );
      case 'timeline':
        return (
          <TeamTimeline
            planningData={planningData}
            sprint={selectedSprint}
            loading={loading}
            jiraBaseUrl={jiraBaseUrl}
          />
        );
      case 'standup':
        return (
          <Standup
            planningData={planningData}
            sprint={selectedSprint}
            loading={loading}
            jiraBaseUrl={jiraBaseUrl}
          />
        );
      case 'team':
        return <TeamConfig boards={boards} selectedBoard={selectedBoard} />;
      case 'calendar':
        return <HolidaysLeaves />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  // Get the tab label for Sprint Planning based on sprint state
  const getPlanningTabLabel = () => {
    if (selectedSprint?.state === 'active') {
      return 'Active Sprint';
    }
    return 'Sprint Planning';
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Sprint Manager</h1>
        <div className="header-actions">
          {connectionStatus === 'connected' && (
            <>
              <div className="dropdown-group">
                <label className="dropdown-label">Project</label>
                <select
                  className="select"
                  value={selectedProject?.id || ''}
                  onChange={(e) => {
                    const project = projects.find(p => p.id === e.target.value);
                    setSelectedProject(project);
                  }}
                  style={{ minWidth: '180px' }}
                >
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
              <div className="dropdown-group">
                <label className="dropdown-label">Board</label>
                <select
                  className="select"
                  value={selectedBoard?.id || ''}
                  onChange={(e) => {
                    const board = boards.find(b => b.id === parseInt(e.target.value));
                    setSelectedBoard(board);
                  }}
                >
                  {boards.length === 0 ? (
                    <option value="">No boards available</option>
                  ) : (
                    boards.map(board => (
                      <option key={board.id} value={board.id}>{board.name}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="dropdown-group">
                <label className="dropdown-label">Sprint</label>
                <select
                  className="select"
                  value={selectedSprint?.id || ''}
                  onChange={(e) => {
                    const sprint = sprints.find(s => s.id === parseInt(e.target.value));
                    setSelectedSprint(sprint);
                  }}
                >
                  {sprints.length === 0 ? (
                    <option value="">No sprints available</option>
                  ) : (
                    sprints.map(sprint => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name} {sprint.state === 'active' ? '(Active)' : sprint.state === 'closed' ? '(Closed)' : '(Future)'}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button 
                className={`btn ${includeClosedSprints ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIncludeClosedSprints(!includeClosedSprints)}
                title={includeClosedSprints ? 'Hide closed sprints' : 'Show closed sprints'}
              >
                <History size={16} />
                {includeClosedSprints ? 'History On' : 'History'}
              </button>
              <button className="btn btn-secondary" onClick={handleRefresh}>
                <RefreshCw size={16} />
                Refresh
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'planning' ? 'active' : ''}`}
          onClick={() => setActiveTab('planning')}
        >
          <BarChart3 size={16} style={{ marginRight: 8 }} />
          {getPlanningTabLabel()}
        </button>
        <button
          className={`tab ${activeTab === 'retro' ? 'active' : ''}`}
          onClick={() => setActiveTab('retro')}
        >
          <ClipboardList size={16} style={{ marginRight: 8 }} />
          Sprint Retro
        </button>
        <button
          className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <GitBranch size={16} style={{ marginRight: 8 }} />
          Timeline
        </button>
        <button
          className={`tab ${activeTab === 'standup' ? 'active' : ''}`}
          onClick={() => setActiveTab('standup')}
        >
          <MessageSquare size={16} style={{ marginRight: 8 }} />
          Standup
        </button>
        <button
          className={`tab ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          <Users size={16} style={{ marginRight: 8 }} />
          Team
        </button>
        <button
          className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <Calendar size={16} style={{ marginRight: 8 }} />
          Holidays & Leaves
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={16} style={{ marginRight: 8 }} />
          Settings
        </button>
      </div>

      {connectionStatus === 'error' && (
        <div className="card" style={{ borderColor: 'var(--accent-red)' }}>
          <p style={{ color: 'var(--accent-red)' }}>
            {error || 'Unable to connect to Jira. Please configure your API credentials in the .env file.'}
          </p>
        </div>
      )}

      {renderContent()}
    </div>
  );
}

export default App;
