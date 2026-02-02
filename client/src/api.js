import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Jira API
export const jiraApi = {
  getBaseUrl: () => api.get('/jira/baseUrl'),
  getProjects: () => api.get('/jira/projects'),
  getBoards: (projectKeyOrId = null) => 
    api.get('/jira/boards', { params: projectKeyOrId ? { projectKeyOrId } : {} }),
  getBoard: (boardId) => api.get(`/jira/boards/${boardId}`),
  getSprints: (boardId, state = 'active,future') => 
    api.get(`/jira/boards/${boardId}/sprints`, { params: { state } }),
  getSprint: (sprintId) => api.get(`/jira/sprints/${sprintId}`),
  getSprintIssues: (sprintId) => api.get(`/jira/sprints/${sprintId}/issues`),
  getProjectUsers: (projectKey) => api.get(`/jira/projects/${projectKey}/users`),
  getCurrentUser: () => api.get('/jira/me'),
  searchIssues: (jql) => api.post('/jira/search', { jql })
};

// Config API
export const configApi = {
  // Team
  getTeam: () => api.get('/config/team'),
  addTeamMember: (member) => api.post('/config/team', member),
  updateTeamMember: (accountId, updates) => api.put(`/config/team/${accountId}`, updates),
  removeTeamMember: (accountId) => api.delete(`/config/team/${accountId}`),
  
  // Holidays
  getHolidays: () => api.get('/config/holidays'),
  addHoliday: (holiday) => api.post('/config/holidays', holiday),
  removeHoliday: (id) => api.delete(`/config/holidays/${id}`),
  
  // Leaves
  getLeaves: () => api.get('/config/leaves'),
  addLeave: (leave) => api.post('/config/leaves', leave),
  updateLeave: (id, updates) => api.put(`/config/leaves/${id}`, updates),
  removeLeave: (id) => api.delete(`/config/leaves/${id}`),
  
  // Sprint Config
  getSprintConfig: () => api.get('/config/sprint'),
  updateSprintConfig: (config) => api.put('/config/sprint', config),
  
  // Boards
  getSavedBoards: () => api.get('/config/boards'),
  saveBoard: (board) => api.post('/config/boards', board)
};

// Capacity API
export const capacityApi = {
  getSprintPlanning: (sprintId) => api.get(`/capacity/sprint/${sprintId}`),
  getBoardSummary: (boardId, state) => 
    api.get(`/capacity/board/${boardId}/summary`, { params: { state } })
};

// Add retro API to jiraApi
jiraApi.getSprintRetro = (sprintId) => api.get(`/retro/sprint/${sprintId}`);

export default api;
