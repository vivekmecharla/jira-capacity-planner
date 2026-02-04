import React, { useState, useEffect } from 'react';
import { ExternalLink, Clock, Calendar, User, AlertCircle, RefreshCw } from 'lucide-react';
import { jiraApi } from '../api';
import './UserWorkLogs.css';

const getJiraLink = (baseUrl, issueKey) => `${baseUrl}/browse/${issueKey}`;

const formatTime = (seconds) => {
  if (!seconds || seconds === 0) return '0h';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return '';
  }
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '';
  }
};

function UserWorkLogs({ accountId, displayName, jiraBaseUrl = '', projectKey = null }) {
  const [workLogs, setWorkLogs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (accountId) {
      fetchWorkLogs();
    }
  }, [accountId, projectKey]);

  const fetchWorkLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await jiraApi.getUserWorkLogs(accountId, projectKey);
      setWorkLogs(response.data.workLogs);
      setSummary(response.data.summary);
    } catch (err) {
      console.error('Work logs fetch error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch work logs';
      const errorStatus = err.response?.status;
      const errorDetails = err.response?.data?.details;
      
      let fullErrorMessage = errorMessage;
      if (errorStatus) {
        fullErrorMessage += ` (Status: ${errorStatus})`;
      }
      if (errorDetails && typeof errorDetails === 'string') {
        fullErrorMessage += ` - ${errorDetails}`;
      }
      
      setError(fullErrorMessage);
      setWorkLogs([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="work-logs-container">
        <div className="work-logs-header">
          <div className="work-logs-title">
            <Clock size={16} />
            <span>Last Working Day's Work Log</span>
          </div>
        </div>
        <div className="work-logs-loading">
          <div className="spinner-small"></div>
          <span>Loading work logs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="work-logs-container">
        <div className="work-logs-header">
          <div className="work-logs-title">
            <Clock size={16} />
            <span>Last Working Day's Work Log</span>
          </div>
          <button 
            className="refresh-btn" 
            onClick={fetchWorkLogs}
            title="Retry fetching work logs"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="work-logs-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!workLogs || workLogs.length === 0) {
    return (
      <div className="work-logs-container">
        <div className="work-logs-header">
          <div className="work-logs-title">
            <Clock size={16} />
            <span>Last Working Day's Work Log</span>
          </div>
          <button 
            className="refresh-btn" 
            onClick={fetchWorkLogs}
            title="Refresh work logs"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        
        <div className="work-logs-empty-card">
          <div className="empty-card-icon">
            <Calendar size={28} />
          </div>
          <div className="empty-card-content">
            <div className="empty-card-title">No Work Logs</div>
            <div className="empty-card-date">
              {summary?.lastWorkingDate ? formatDate(summary.lastWorkingDate) : 'Last working day'}
            </div>
            <div className="empty-card-message">
              No time entries were logged on this day
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="work-logs-container">
      <div className="work-logs-header">
        <div className="work-logs-title">
          <Clock size={16} />
          <span>Last Working Day's Work Log</span>
        </div>
        <button 
          className="refresh-btn" 
          onClick={fetchWorkLogs}
          title="Refresh work logs"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      
      {summary && (
        <div className="work-logs-summary">
          <div className="summary-item">
            <span className="summary-label">Date:</span>
            <span className="summary-value">{formatDate(summary.lastWorkingDate)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Time:</span>
            <span className="summary-value">{formatTime(summary.totalHours * 3600)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Entries:</span>
            <span className="summary-value">{summary.count}</span>
          </div>
        </div>
      )}
      
      <div className="work-logs-list">
        {workLogs.map((log) => (
          <div key={log.id} className="work-log-item">
            <div className="work-log-main">
              <div className="work-log-header">
                <a 
                  href={getJiraLink(jiraBaseUrl, log.issueKey)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="issue-key"
                >
                  {log.issueKey}
                  <ExternalLink size={10} style={{ marginLeft: 4 }} />
                </a>
                <span className="work-log-time">{formatTime(log.timeSpent)}</span>
              </div>
              <div className="work-log-summary">{log.issueSummary}</div>
              {log.comment && (
                <div className="work-log-comment">{log.comment}</div>
              )}
              <div className="work-log-meta">
                <span className="work-log-date">{formatDateTime(log.started)}</span>
                {log.author && (
                  <div className="work-log-author">
                    <User size={10} />
                    <span>{log.author.displayName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
    </div>
  );
}

export default UserWorkLogs;
