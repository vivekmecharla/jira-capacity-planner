import React, { useState, useEffect } from 'react';
import { Save, Info } from 'lucide-react';
import { configApi } from '../api';

function SettingsPanel() {
  const [config, setConfig] = useState({
    defaultSprintDays: 8,
    hoursPerDay: 8
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await configApi.getSprintConfig();
      setConfig(response.data);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const saveConfig = async () => {
    try {
      await configApi.updateSprintConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Sprint Configuration</h3>
        </div>

        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label">Working Days per Sprint</label>
            <input
              type="number"
              className="input"
              min="1"
              max="30"
              value={config.defaultSprintDays}
              onChange={(e) => setConfig({ ...config, defaultSprintDays: parseInt(e.target.value) || 8 })}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Default: 8 days (instead of 10 calendar days)
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Working Hours per Day</label>
            <input
              type="number"
              className="input"
              min="1"
              max="24"
              value={config.hoursPerDay}
              onChange={(e) => setConfig({ ...config, hoursPerDay: parseInt(e.target.value) || 8 })}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Used to calculate total available hours
            </p>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <button className="btn btn-primary" onClick={saveConfig}>
            <Save size={16} />
            Save Settings
          </button>
          {saved && (
            <span style={{ marginLeft: '12px', color: 'var(--accent-green)', fontSize: '13px' }}>
              Settings saved!
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Info size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            How Capacity is Calculated
          </h3>
        </div>

        <div style={{ fontSize: '13px', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
          <p><strong>Team Capacity Formula:</strong></p>
          <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
            <li>Working Days = Sprint Duration - Weekends - Holidays</li>
            <li>Available Days = Working Days - Leave Days</li>
            <li>Available Hours = Available Days × Hours per Day</li>
          </ul>

          <p style={{ marginTop: '16px' }}><strong>Utilization:</strong></p>
          <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
            <li>Committed Hours = Sum of Original Estimates on assigned issues</li>
            <li>Remaining Capacity = Available Hours - Committed Hours</li>
            <li>Utilization % = (Committed / Available) × 100</li>
          </ul>

          <p style={{ marginTop: '16px' }}><strong>Status Indicators:</strong></p>
          <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
            <li><span style={{ color: 'var(--accent-green)' }}>Green</span>: Under 80% utilization</li>
            <li><span style={{ color: 'var(--accent-yellow)' }}>Yellow</span>: 80-100% utilization</li>
            <li><span style={{ color: 'var(--accent-red)' }}>Red</span>: Over 100% (overcommitted)</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Jira API Configuration</h3>
        </div>

        <div style={{ fontSize: '13px', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
          <p>Configure your Jira credentials in the <code>.env</code> file:</p>
          
          <div style={{ 
            background: 'var(--bg-secondary)', 
            padding: '16px', 
            borderRadius: '8px', 
            marginTop: '12px',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            <div>JIRA_BASE_URL=https://your-domain.atlassian.net</div>
            <div>JIRA_EMAIL=your-email@example.com</div>
            <div>JIRA_API_TOKEN=your-api-token</div>
          </div>

          <p style={{ marginTop: '16px' }}>
            <strong>To get your API token:</strong>
          </p>
          <ol style={{ marginLeft: '20px', marginTop: '8px' }}>
            <li>Go to <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>Atlassian API Tokens</a></li>
            <li>Click "Create API token"</li>
            <li>Give it a name and copy the token</li>
            <li>Paste it in your .env file</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
