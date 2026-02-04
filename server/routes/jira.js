const express = require('express');
const router = express.Router();
const jiraClient = require('../services/jiraClient');
const { createLogger } = require('../utils/logger');

const logger = createLogger('JiraRoutes');

// Get Jira base URL for frontend links
router.get('/baseUrl', (req, res) => {
  res.json({ baseUrl: process.env.JIRA_BASE_URL || '' });
});

// Get all projects
router.get('/projects', async (req, res) => {
  try {
    const projects = await jiraClient.getProjects();
    logger.info('Fetched projects', { count: projects.length });
    res.json(projects);
  } catch (error) {
    logger.error('Error fetching projects', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get all boards (optionally filtered by project)
router.get('/boards', async (req, res) => {
  try {
    const { projectKeyOrId } = req.query;
    let boards;
    if (projectKeyOrId) {
      boards = await jiraClient.getBoardsForProject(projectKeyOrId);
      logger.info('Fetched boards for project', { project: projectKeyOrId, count: boards.length });
    } else {
      boards = await jiraClient.getBoards();
      logger.info('Fetched all boards', { count: boards.length });
    }
    res.json(boards);
  } catch (error) {
    logger.error('Error fetching boards', { error: error.message, projectKeyOrId: req.query.projectKeyOrId });
    res.status(500).json({ error: error.message });
  }
});

// Get board by ID
router.get('/boards/:boardId', async (req, res) => {
  try {
    const board = await jiraClient.getBoardById(req.params.boardId);
    logger.info('Fetched board', { boardId: req.params.boardId });
    res.json(board);
  } catch (error) {
    logger.error('Error fetching board', { boardId: req.params.boardId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get sprints for a board
router.get('/boards/:boardId/sprints', async (req, res) => {
  try {
    const { state } = req.query;
    logger.info('Fetching sprints', { boardId: req.params.boardId, state: state || 'active,future' });
    const sprints = await jiraClient.getSprints(req.params.boardId, state || 'active,future');
    logger.info('Fetched sprints', { boardId: req.params.boardId, count: sprints.length });
    res.json(sprints);
  } catch (error) {
    logger.error('Error fetching sprints', { 
      boardId: req.params.boardId, 
      error: error.message,
      status: error.response?.status
    });
    res.status(500).json({ error: error.message, details: error.response?.data });
  }
});

// Get sprint by ID
router.get('/sprints/:sprintId', async (req, res) => {
  try {
    const sprint = await jiraClient.getSprintById(req.params.sprintId);
    logger.info('Fetched sprint', { sprintId: req.params.sprintId });
    res.json(sprint);
  } catch (error) {
    logger.error('Error fetching sprint', { sprintId: req.params.sprintId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get issues for a sprint
router.get('/sprints/:sprintId/issues', async (req, res) => {
  try {
    const { startAt, maxResults } = req.query;
    const issues = await jiraClient.getSprintIssues(
      req.params.sprintId,
      parseInt(startAt) || 0,
      parseInt(maxResults) || 100
    );
    logger.info('Fetched sprint issues', { sprintId: req.params.sprintId, count: issues.issues?.length || 0 });
    res.json(issues);
  } catch (error) {
    logger.error('Error fetching sprint issues', { sprintId: req.params.sprintId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get project users
router.get('/projects/:projectKey/users', async (req, res) => {
  try {
    const users = await jiraClient.getProjectUsers(req.params.projectKey);
    logger.info('Fetched project users', { projectKey: req.params.projectKey, count: users.length });
    res.json(users);
  } catch (error) {
    logger.error('Error fetching project users', { projectKey: req.params.projectKey, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Search issues with JQL
router.post('/search', async (req, res) => {
  try {
    const { jql, startAt, maxResults } = req.body;
    const results = await jiraClient.searchIssues(jql, startAt, maxResults);
    logger.info('Searched issues', { jql: jql?.substring(0, 100), resultCount: results.issues?.length || 0 });
    res.json(results);
  } catch (error) {
    logger.error('Error searching issues', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get current user (for testing connection)
router.get('/me', async (req, res) => {
  try {
    const user = await jiraClient.getCurrentUser();
    logger.info('Fetched current user', { accountId: user.accountId });
    res.json(user);
  } catch (error) {
    logger.error('Error fetching current user', { 
      error: error.message,
      status: error.response?.status
    });
    res.status(500).json({ 
      error: error.message,
      status: error.response?.status,
      details: error.response?.data
    });
  }
});

// Get user's worklogs for the last working day
router.get('/users/:accountId/worklogs', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { projectKey } = req.query;
    
    // Get last working day (skip weekends)
    const lastWorkingDay = jiraClient.getLastWorkingDay();
    
    logger.info('Fetching worklogs for user', { 
      accountId, 
      date: lastWorkingDay.toISOString().split('T')[0],
      projectKey 
    });
    
    const workLogs = await jiraClient.getUserWorkLogsForDate(accountId, lastWorkingDay, projectKey);
    
    // Calculate summary
    const totalSeconds = workLogs.reduce((sum, wl) => sum + (wl.timeSpent || 0), 0);
    const totalHours = totalSeconds / 3600;
    
    logger.info('Fetched user worklogs', { 
      accountId, 
      count: workLogs.length,
      totalHours: totalHours.toFixed(2)
    });
    
    res.json({
      workLogs,
      summary: {
        lastWorkingDate: lastWorkingDay.toISOString().split('T')[0],
        count: workLogs.length,
        totalHours: parseFloat(totalHours.toFixed(2))
      }
    });
  } catch (error) {
    logger.error('Error fetching user worklogs', { 
      accountId: req.params.accountId, 
      error: error.message 
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
