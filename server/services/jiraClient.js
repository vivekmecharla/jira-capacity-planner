const axios = require('axios');

class JiraClient {
  constructor() {
    this.baseUrl = process.env.JIRA_BASE_URL;
    this.email = process.env.JIRA_EMAIL;
    // Strip quotes if present (dotenv sometimes keeps them)
    this.apiToken = (process.env.JIRA_API_TOKEN || '').replace(/^['"]|['"]$/g, '');
    
    console.log('Jira Client initialized:');
    console.log('  Base URL:', this.baseUrl);
    console.log('  Email:', this.email);
    console.log('  Token length:', this.apiToken?.length);
    console.log('  Token:', this.apiToken ? '[CONFIGURED]' : 'NOT SET');
  }

  getClient() {
    const authString = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  async getBoards() {
    const client = this.getClient();
    let allBoards = [];
    let startAt = 0;
    let hasMore = true;
    
    while (hasMore) {
      const response = await client.get('/rest/agile/1.0/board', {
        params: { startAt, maxResults: 50 }
      });
      allBoards = allBoards.concat(response.data.values);
      startAt += response.data.values.length;
      hasMore = !response.data.isLast && response.data.values.length > 0;
    }
    
    return allBoards;
  }

  async getBoardById(boardId) {
    const client = this.getClient();
    const response = await client.get(`/rest/agile/1.0/board/${boardId}`);
    return response.data;
  }

  async getSprints(boardId, state = 'active,future') {
    const client = this.getClient();
    const response = await client.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
      params: { state }
    });
    return response.data.values;
  }

  async getSprintById(sprintId) {
    const client = this.getClient();
    const response = await client.get(`/rest/agile/1.0/sprint/${sprintId}`);
    return response.data;
  }

  async getSprintIssues(sprintId, startAt = 0, maxResults = 100) {
    const client = this.getClient();
    const response = await client.get(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
      params: {
        startAt,
        maxResults,
        fields: '*all',
        expand: 'changelog'
      }
    });
    return response.data;
  }

  async getIssue(issueKey) {
    const client = this.getClient();
    const response = await client.get(`/rest/api/3/issue/${issueKey}`, {
      params: {
        fields: 'summary,status,assignee,timeoriginalestimate,timespent,timeestimate,issuetype,priority,customfield_10016,parent,subtasks'
      }
    });
    return response.data;
  }

  async getProjectUsers(projectKey) {
    const client = this.getClient();
    let allUsers = [];
    let startAt = 0;
    let hasMore = true;
    
    while (hasMore) {
      const response = await client.get(`/rest/api/3/user/assignable/search`, {
        params: {
          project: projectKey,
          startAt,
          maxResults: 100
        }
      });
      allUsers = allUsers.concat(response.data);
      startAt += response.data.length;
      hasMore = response.data.length === 100;
    }
    
    console.log('Found', allUsers.length, 'users for project', projectKey);
    return allUsers;
  }

  async searchIssues(jql, startAt = 0, maxResults = 100) {
    const client = this.getClient();
    const response = await client.post('/rest/api/3/search', {
      jql,
      startAt,
      maxResults,
      fields: ['summary', 'status', 'assignee', 'timeoriginalestimate', 'timespent', 'timeestimate', 'issuetype', 'priority', 'customfield_10016', 'parent', 'subtasks']
    });
    return response.data;
  }

  async getWorkLogs(issueKey, startedAfter = null, startedBefore = null) {
    const client = this.getClient();
    const params = {};
    
    if (startedAfter) {
      params.startedAfter = startedAfter;
    }
    if (startedBefore) {
      params.startedBefore = startedBefore;
    }
    
    const response = await client.get(`/rest/api/3/issue/${issueKey}/worklog`, {
      params
    });
    return response.data;
  }

  async getCurrentUser() {
    const client = this.getClient();
    const response = await client.get('/rest/api/3/myself');
    return response.data;
  }

  async getProjects() {
    const client = this.getClient();
    let allProjects = [];
    let startAt = 0;
    let hasMore = true;
    
    while (hasMore) {
      const response = await client.get('/rest/api/3/project/search', {
        params: { startAt, maxResults: 50 }
      });
      allProjects = allProjects.concat(response.data.values);
      startAt += response.data.values.length;
      hasMore = !response.data.isLast && response.data.values.length > 0;
    }
    
    return allProjects;
  }

  async getBoardsForProject(projectKeyOrId) {
    const client = this.getClient();
    let allBoards = [];
    let startAt = 0;
    let hasMore = true;
    
    while (hasMore) {
      const response = await client.get('/rest/agile/1.0/board', {
        params: { startAt, maxResults: 50, projectKeyOrId }
      });
      allBoards = allBoards.concat(response.data.values);
      startAt += response.data.values.length;
      hasMore = !response.data.isLast && response.data.values.length > 0;
    }
    
    return allBoards;
  }

  async getUserWorkLogsForDate(accountId, date, projectKey = null) {
    const client = this.getClient();
    
    // Format date for filtering (YYYY-MM-DD)
    const dateStr = date.toISOString().split('T')[0];
    
    // Create date range for the full day (00:00:00 to 23:59:59)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    try {
      // Primary approach: Use the updated worklogs API to get worklogs updated in a wider time window
      // to ensure we don't miss worklogs that were logged on the target date
      const sinceDate = new Date(startOfDay);
      sinceDate.setDate(sinceDate.getDate() - 7); // Look back 7 days to catch delayed updates
      
      const updatedResponse = await client.get('/rest/api/3/worklog/updated', {
        params: {
          since: sinceDate.getTime()
        }
      });
      
      const worklogIds = (updatedResponse.data.values || []).map(v => v.worklogId);
      
      let allWorklogs = [];
      if (worklogIds.length > 0) {
        // Fetch worklog details in batches (API limit is 1000 per request)
        const batchSize = 1000;
        for (let i = 0; i < worklogIds.length; i += batchSize) {
          const batch = worklogIds.slice(i, i + batchSize);
          const worklogDetails = await client.post('/rest/api/3/worklog/list', {
            ids: batch
          });
          allWorklogs = allWorklogs.concat(worklogDetails.data || []);
        }
      }
      
      const workLogs = [];
      
      // Filter worklogs by author and started date within the full day range
      for (const wl of allWorklogs) {
        if (!wl.started || !wl.author?.accountId) continue;
        
        const wlStarted = new Date(wl.started);
        const isWithinDayRange = wlStarted >= startOfDay && wlStarted <= endOfDay;
        const isCorrectUser = wl.author.accountId === accountId;
        
        if (isWithinDayRange && isCorrectUser) {
          // Fetch issue details for this worklog
          try {
            const issueResponse = await client.get(`/rest/api/3/issue/${wl.issueId}`, {
              params: {
                fields: 'summary,status,issuetype,key'
              }
            });
            const issue = issueResponse.data;
            
            workLogs.push({
              id: wl.id,
              issueKey: issue.key,
              issueSummary: issue.fields.summary,
              issueType: issue.fields.issuetype?.name,
              issueStatus: issue.fields.status?.name,
              timeSpent: wl.timeSpentSeconds,
              timeSpentDisplay: wl.timeSpent,
              comment: wl.comment?.content?.[0]?.content?.[0]?.text || '',
              started: wl.started,
              author: wl.author
            });
          } catch (issueErr) {
            console.error(`Error fetching issue ${wl.issueId}:`, issueErr.message);
          }
        }
      }
      
      // Sort by started time
      workLogs.sort((a, b) => new Date(a.started) - new Date(b.started));
      
      return workLogs;
    } catch (err) {
      console.error('Error fetching updated worklogs:', err.message);
      
      // Fallback: Search for issues assigned to user and check their worklogs
      return this.getUserWorkLogsForDateFallback(accountId, date, projectKey);
    }
  }
  
  async getUserWorkLogsForDateFallback(accountId, date, projectKey = null) {
    const client = this.getClient();
    const dateStr = date.toISOString().split('T')[0];
    
    // Fallback: Search for issues the user has worked on recently
    let jql = `assignee = "${accountId}" OR reporter = "${accountId}"`;
    if (projectKey) {
      jql = `(${jql}) AND project = "${projectKey}"`;
    }
    jql += ' ORDER BY updated DESC';
    
    const response = await client.post('/rest/api/3/search', {
      jql,
      startAt: 0,
      maxResults: 50,
      fields: ['summary', 'status', 'issuetype']
    });
    
    const issues = response.data.issues || [];
    const workLogs = [];
    
    // For each issue, fetch worklogs and filter by user and date
    for (const issue of issues) {
      try {
        const worklogResponse = await client.get(`/rest/api/3/issue/${issue.key}/worklog`);
        const issueWorklogs = worklogResponse.data.worklogs || [];
        
        // Filter worklogs by author and date
        const userWorklogs = issueWorklogs.filter(wl => {
          const wlDate = new Date(wl.started).toISOString().split('T')[0];
          return wl.author?.accountId === accountId && wlDate === dateStr;
        });
        
        // Add issue info to each worklog
        userWorklogs.forEach(wl => {
          workLogs.push({
            id: wl.id,
            issueKey: issue.key,
            issueSummary: issue.fields.summary,
            issueType: issue.fields.issuetype?.name,
            issueStatus: issue.fields.status?.name,
            timeSpent: wl.timeSpentSeconds,
            timeSpentDisplay: wl.timeSpent,
            comment: wl.comment?.content?.[0]?.content?.[0]?.text || '',
            started: wl.started,
            author: wl.author
          });
        });
      } catch (err) {
        console.error(`Error fetching worklogs for ${issue.key}:`, err.message);
      }
    }
    
    return workLogs;
  }

  getLastWorkingDay(fromDate = new Date()) {
    const date = new Date(fromDate);
    date.setDate(date.getDate() - 1); // Start from yesterday
    
    // Skip weekends (Saturday = 6, Sunday = 0)
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() - 1);
    }
    
    return date;
  }
}

module.exports = new JiraClient();
