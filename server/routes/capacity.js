const express = require('express');
const router = express.Router();
const jiraClient = require('../services/jiraClient');
const database = require('../services/database');
const capacityCalculator = require('../services/capacityCalculator');
const { createLogger } = require('../utils/logger');

const logger = createLogger('CapacityRoutes');

// Get full sprint planning data
router.get('/sprint/:sprintId', async (req, res) => {
  try {
    const sprintId = req.params.sprintId;
    
    // Get sprint details
    const sprint = await jiraClient.getSprintById(sprintId);
    
    // Get all issues in sprint
    let allIssues = [];
    let startAt = 0;
    let hasMore = true;
    
    while (hasMore) {
      const result = await jiraClient.getSprintIssues(sprintId, startAt, 100);
      allIssues = allIssues.concat(result.issues);
      startAt += result.issues.length;
      hasMore = result.issues.length === 100;
    }
    
    // Get team members from config, optionally filtered by board
    const { boardId } = req.query;
    let teamMembers = database.getTeamMembers();
    
    if (boardId) {
      const boardIdNum = parseInt(boardId);
      teamMembers = teamMembers.filter(m => {
        // If member has no board assignments, include them in all boards (backward compatible)
        if (!m.boardAssignments || m.boardAssignments.length === 0) return true;
        return m.boardAssignments.some(ba => ba.boardId === boardIdNum);
      });
    }
    
    // Calculate team capacity (now async - fetches holidays/leaves from Zoho)
    const teamCapacity = await capacityCalculator.calculateTeamCapacity(
      teamMembers,
      sprint.startDate,
      sprint.endDate
    );
    
    // Fetch worklogs for all issues between sprint dates (only for non-future sprints)
    const worklogsByIssue = {};
    const sprintStartDate = sprint.startDate ? new Date(sprint.startDate) : null;
    const sprintEndDate = sprint.endDate ? new Date(sprint.endDate) : null;
    
    if (sprint.state !== 'future' && sprintStartDate && sprintEndDate) {
      // Fetch worklogs in parallel for better performance
      const worklogPromises = allIssues.map(async (issue) => {
        try {
          const worklogs = await jiraClient.getWorkLogs(issue.key);
          if (worklogs && worklogs.worklogs && worklogs.worklogs.length > 0) {
            worklogsByIssue[issue.key] = worklogs.worklogs;
          }
        } catch (err) {
          logger.debug(`Could not fetch worklogs for ${issue.key}`, { error: err.message });
        }
      });
      await Promise.all(worklogPromises);
    }
    
    // Calculate assigned work - include all issues (Done tickets needed for Standup page)
    // Frontend will filter out Done tickets for Sprint Planning display if needed
    const assignedWork = capacityCalculator.calculateAssignedWork(
      allIssues, 
      teamMembers, 
      sprintStartDate, 
      sprint.name, 
      false, // excludeDone = false - include all issues for Standup page
      sprintEndDate,
      sprint.state,
      worklogsByIssue
    );
    
    // Generate planning data
    const planning = capacityCalculator.calculateSprintPlanning(teamCapacity, assignedWork);
    
    logger.info('Calculated sprint capacity', { 
      sprintId, 
      sprintName: sprint.name, 
      issueCount: allIssues.length,
      memberCount: planning.members?.length || 0
    });
    
    res.json({
      sprint: {
        id: sprint.id,
        name: sprint.name,
        state: sprint.state,
        startDate: sprint.startDate,
        endDate: sprint.endDate
      },
      planning,
      rawIssues: allIssues
    });
  } catch (error) {
    logger.error('Error calculating sprint capacity', { sprintId: req.params.sprintId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get capacity summary for multiple sprints
router.get('/board/:boardId/summary', async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const { state } = req.query;
    
    const sprints = await jiraClient.getSprints(boardId, state || 'active,future');
    let teamMembers = database.getTeamMembers();
    
    const boardIdNum = parseInt(boardId);
    if (boardIdNum) {
      teamMembers = teamMembers.filter(m => {
        if (!m.boardAssignments || m.boardAssignments.length === 0) return true;
        return m.boardAssignments.some(ba => ba.boardId === boardIdNum);
      });
    }
    
    const summaries = await Promise.all(sprints.map(async (sprint) => {
      try {
        const issues = await jiraClient.getSprintIssues(sprint.id, 0, 100);
        
        const teamCapacity = await capacityCalculator.calculateTeamCapacity(
          teamMembers,
          sprint.startDate,
          sprint.endDate
        );
        
        const sprintStart = sprint.startDate ? new Date(sprint.startDate) : null;
        const assignedWork = capacityCalculator.calculateAssignedWork(issues.issues, teamMembers, sprintStart, sprint.name);
        const planning = capacityCalculator.calculateSprintPlanning(teamCapacity, assignedWork);
        
        return {
          sprint: {
            id: sprint.id,
            name: sprint.name,
            state: sprint.state,
            startDate: sprint.startDate,
            endDate: sprint.endDate
          },
          totals: planning.totals
        };
      } catch (err) {
        return {
          sprint: {
            id: sprint.id,
            name: sprint.name,
            state: sprint.state
          },
          error: err.message
        };
      }
    }));
    
    logger.info('Fetched board summary', { boardId, sprintCount: summaries.length });
    res.json(summaries);
  } catch (error) {
    logger.error('Error fetching board summary', { boardId: req.params.boardId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
