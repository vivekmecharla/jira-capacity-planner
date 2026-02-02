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
}

module.exports = new JiraClient();
