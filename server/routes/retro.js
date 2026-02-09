const express = require('express');
const router = express.Router();
const jiraClient = require('../services/jiraClient');
const database = require('../services/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RetroRoutes');

// Get sprint retrospective data
router.get('/sprint/:sprintId', async (req, res) => {
  try {
    const sprintId = req.params.sprintId;
    
    // Get sprint details
    const sprint = await jiraClient.getSprintById(sprintId);
    
    // Get all issues in sprint with changelog
    let allIssues = [];
    let startAt = 0;
    let hasMore = true;
    
    while (hasMore) {
      const response = await jiraClient.getSprintIssues(sprintId, startAt, 100);
      allIssues = allIssues.concat(response.issues || []);
      startAt += (response.issues?.length || 0);
      hasMore = response.issues?.length === 100;
    }
    
    const sprintStartDate = new Date(sprint.startDate);
    
    // Get team members for role lookup, optionally filtered by board
    const { boardId } = req.query;
    let teamMembers = database.getTeamMembers();
    
    if (boardId) {
      const boardIdNum = parseInt(boardId);
      teamMembers = teamMembers.filter(m => {
        if (!m.boardAssignments || m.boardAssignments.length === 0) return true;
        return m.boardAssignments.some(ba => ba.boardId === boardIdNum);
      });
    }
    
    const memberRoles = {};
    teamMembers.forEach(member => {
      memberRoles[member.accountId] = member.role || 'Developer';
    });
    
    // Helper to check if a subtask is Dev work
    const isDevSubtask = (issue) => {
      const summary = (issue.fields.summary || '').toLowerCase();
      const assigneeId = issue.fields.assignee?.accountId;
      const assigneeRole = assigneeId ? memberRoles[assigneeId] : null;
      
      // Check if summary starts with "dev" (case insensitive)
      if (summary.startsWith('dev')) return true;
      
      // Check if assigned to Developer or Dev Lead
      if (assigneeRole === 'Developer' || assigneeRole === 'Dev Lead') return true;
      
      return false;
    };
    
    // Helper to check if a subtask is QA work
    const isQaSubtask = (issue) => {
      const summary = (issue.fields.summary || '').toLowerCase();
      const assigneeId = issue.fields.assignee?.accountId;
      const assigneeRole = assigneeId ? memberRoles[assigneeId] : null;
      
      // Check if summary starts with "qa" (case insensitive)
      if (summary.startsWith('qa')) return true;
      
      // Check if assigned to QA or QA Lead
      if (assigneeRole === 'QA' || assigneeRole === 'QA Lead') return true;
      
      return false;
    };
    
    // First pass: collect subtask info by parent key for aggregation (used for Dev/QA estimate calculation)
    const subtaskAggregation = {};
    allIssues.forEach(issue => {
      if (issue.fields.issuetype?.subtask === true) {
        const parentKey = issue.fields.parent?.key;
        if (parentKey) {
          if (!subtaskAggregation[parentKey]) {
            subtaskAggregation[parentKey] = [];
          }
          const estimate = (issue.fields.timeoriginalestimate || 0) / 3600;
          subtaskAggregation[parentKey].push({
            key: issue.key,
            summary: issue.fields.summary,
            estimate,
            assigneeId: issue.fields.assignee?.accountId,
            isDev: isDevSubtask(issue),
            isQa: isQaSubtask(issue)
          });
        }
      }
    });
    
    // Process issues
    const processedIssues = allIssues.map(issue => {
      const issueCreatedDate = new Date(issue.fields.created);
      
      // Check if issue was added after sprint started and if it's a carryover
      // Carryover = moved from another sprint BEFORE sprint started
      // Late = added to sprint AFTER sprint started (mutually exclusive with carryover)
      let isLateAddition = false;
      let isCarryover = false;
      let addedToSprintDate = null;
      
      // Check changelog for when issue was added to this sprint and carryover status
      if (issue.changelog?.histories) {
        for (const history of issue.changelog.histories) {
          for (const item of history.items) {
            if (item.field === 'Sprint' && item.to && item.toString?.includes(sprint.name)) {
              addedToSprintDate = new Date(history.created);
              
              // Check if added after sprint started - this is a LATE addition
              if (addedToSprintDate > sprintStartDate) {
                isLateAddition = true;
                // Late additions are NOT carryovers, even if they came from another sprint
              } else if (item.from && item.fromString) {
                // Only mark as carryover if it came from another sprint AND was added BEFORE sprint started
                isCarryover = true;
              }
              break;
            }
          }
        }
      }
      
      // If no sprint change found in changelog, check if created after sprint start
      if (!addedToSprintDate && issueCreatedDate > sprintStartDate) {
        isLateAddition = true;
        addedToSprintDate = issueCreatedDate;
      }
      
      const originalEstimate = (issue.fields.timeoriginalestimate || 0) / 3600;
      const timeSpent = (issue.fields.timespent || 0) / 3600;
      const remainingEstimate = (issue.fields.timeestimate || 0) / 3600;
      
      // Determine if issue is completed based on status and type
      const statusName = issue.fields.status?.name || '';
      const issueTypeName = issue.fields.issuetype?.name;
      const isBugOrProdIssue = issueTypeName === 'Bug' || issueTypeName === 'Incident' || issueTypeName === 'Production Issue';
      
      // Completed statuses for Production Issues/Bugs (from workflow - green boxes)
      const prodCompletedStatuses = [
        'done', 'deployed pending monitoring', 'deployed - monitoring completed',
        'not a bug', 'duplicate', 'fix not needed', 'enhancement completed'
      ];
      // Completed statuses for Tech Stories (standard workflow)
      const techCompletedStatuses = ['done', 'closed', 'resolved', 'complete'];
      
      const isCompleted = isBugOrProdIssue
        ? prodCompletedStatuses.some(s => statusName.toLowerCase() === s || statusName.toLowerCase().includes(s))
        : techCompletedStatuses.some(s => statusName.toLowerCase().includes(s));
      
      // Check if completed before sprint start
      let isCompletedBeforeSprint = false;
      let completedDate = null;
      if (isCompleted && issue.changelog?.histories && sprintStartDate) {
        for (const history of issue.changelog.histories) {
          for (const item of history.items || []) {
            if (item.field === 'status') {
              const newStatus = item.toString?.toLowerCase() || '';
              const isCompletedStatus = isBugOrProdIssue
                ? prodCompletedStatuses.some(s => newStatus === s || newStatus.includes(s))
                : techCompletedStatuses.some(s => newStatus.includes(s));
              
              if (isCompletedStatus) {
                completedDate = new Date(history.created);
                if (completedDate < sprintStartDate) {
                  isCompletedBeforeSprint = true;
                }
                break;
              }
            }
          }
          if (completedDate) break;
        }
      }
      
      // Calculate Dev and QA estimates
      let devEstimate = 0;
      let qaEstimate = 0;
      
      const isSubtaskType = issue.fields.issuetype?.subtask === true;
      const childSubtasksForAggregation = subtaskAggregation[issue.key] || [];
      
      if (isSubtaskType) {
        // For subtasks, determine if it's Dev or QA work based on name or assignee
        const isDev = isDevSubtask(issue);
        const isQa = isQaSubtask(issue);
        
        if (isDev) {
          devEstimate = originalEstimate;
        } else if (isQa) {
          qaEstimate = originalEstimate;
        } else {
          // Default to Dev if not identified
          devEstimate = originalEstimate;
        }
      } else if (childSubtasksForAggregation.length > 0) {
        // For parent issues with subtasks, aggregate from subtasks
        childSubtasksForAggregation.forEach(st => {
          if (st.isDev) {
            devEstimate += st.estimate;
          } else if (st.isQa) {
            qaEstimate += st.estimate;
          } else {
            // If not identified as Dev or QA, default to Dev
            devEstimate += st.estimate;
          }
        });
      }
      
      return {
        key: issue.key,
        summary: issue.fields.summary,
        status: statusName,
        issueType: issueTypeName,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.displayName,
        assigneeId: issue.fields.assignee?.accountId,
        originalEstimate,
        devEstimate,
        qaEstimate,
        timeSpent,
        workLogged: timeSpent, // For retro, use timeSpent as workLogged (already logged work)
        remainingEstimate,
        dueDate: issue.fields.duedate,
        created: issue.fields.created,
        isLateAddition,
        isCarryover,
        addedToSprintDate: addedToSprintDate?.toISOString(),
        storyPoints: issue.fields.customfield_10016 || issue.fields.customfield_10026 || issue.fields.customfield_10004 || null,
        parentKey: issue.fields.parent?.key,
        isSubtask: issue.fields.issuetype?.subtask === true,
        isCompleted,
        isCompletedBeforeSprint
      };
    });
    
    // Separate subtasks from parent issues
    const subtasks = processedIssues.filter(i => i.isSubtask);
    const parentIssues = processedIssues.filter(i => !i.isSubtask);
    
    // Separate tech stories and production issues/bugs (excluding subtasks)
    const techStories = parentIssues.filter(i => 
      i.issueType === 'Story' || i.issueType === 'Task' || i.issueType === 'Technical Task'
    );
    
    const productionIssues = parentIssues.filter(i => 
      i.issueType === 'Bug' || i.issueType === 'Incident' || i.issueType === 'Production Issue'
    );
    
    // Group processed subtasks by parent (with full data including status, estimates, etc.)
    const subtasksByParent = {};
    subtasks.forEach(st => {
      if (st.parentKey) {
        if (!subtasksByParent[st.parentKey]) subtasksByParent[st.parentKey] = [];
        subtasksByParent[st.parentKey].push(st);
      }
    });
    
    // Calculate summary - EXCLUDING SUBTASKS
    // Completed statuses for Tech Stories (standard workflow)
    const techStoryCompletedStatuses = ['done', 'closed', 'resolved', 'complete'];
    
    // Completed statuses for Production Issues/Bugs (from workflow - green boxes)
    const productionIssueCompletedStatuses = [
      'done',
      'deployed pending monitoring',
      'deployed - monitoring completed',
      'not a bug',
      'duplicate',
      'fix not needed',
      'enhancement completed'
    ];
    
    // Committed tickets = tickets that were in sprint at start (not late additions)
    const committedTickets = parentIssues.filter(i => !i.isLateAddition);
    const committedStoryPoints = committedTickets.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
    
    // Helper function to check if issue is completed based on type
    const isIssueCompleted = (issue) => {
      const status = issue.status?.toLowerCase() || '';
      const isBugOrProdIssue = issue.issueType === 'Bug' || issue.issueType === 'Incident' || issue.issueType === 'Production Issue';
      
      if (isBugOrProdIssue) {
        return productionIssueCompletedStatuses.some(s => status === s || status.includes(s));
      } else {
        return techStoryCompletedStatuses.some(s => status.includes(s));
      }
    };
    
    // Completed tickets (excluding subtasks)
    const completedParentIssues = parentIssues.filter(i => isIssueCompleted(i));
    const completedStoryPoints = completedParentIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
    
    // Mid-sprint additions (late additions, excluding subtasks)
    const midSprintAdditions = parentIssues.filter(i => i.isLateAddition);
    
    // Overdue tickets (excluding subtasks)
    const now = new Date();
    const overdueTickets = parentIssues.filter(i => {
      if (!i.dueDate) return false;
      const dueDate = new Date(i.dueDate);
      return !isIssueCompleted(i) && dueDate < now;
    });
    
    // Calculate Tech Stories metrics
    const techStoriesCommitted = techStories.filter(i => !i.isLateAddition);
    const techStoriesCompleted = techStories.filter(i => 
      techStoryCompletedStatuses.some(s => i.status?.toLowerCase().includes(s))
    );
    const techStoriesMidSprint = techStories.filter(i => i.isLateAddition);
    const techStoriesOverdue = techStories.filter(i => {
      if (!i.dueDate) return false;
      const dueDate = new Date(i.dueDate);
      const isComplete = techStoryCompletedStatuses.some(s => i.status?.toLowerCase().includes(s));
      return !isComplete && dueDate < now;
    });
    
    const techStoriesSummary = {
      committedStoryPoints: techStoriesCommitted.reduce((sum, i) => sum + (i.storyPoints || 0), 0),
      committedTickets: techStoriesCommitted.length,
      totalTicketsAtEnd: techStories.length,
      completedStoryPoints: techStoriesCompleted.reduce((sum, i) => sum + (i.storyPoints || 0), 0),
      completedTickets: techStoriesCompleted.length,
      incompleteTickets: techStories.length - techStoriesCompleted.length,
      midSprintAdditions: techStoriesMidSprint.length,
      overdueTickets: techStoriesOverdue.length,
      completionRate: techStories.length > 0 
        ? Math.round((techStoriesCompleted.length / techStories.length) * 100) 
        : 0
    };
    
    // Calculate Production Issues metrics
    const prodIssuesCommitted = productionIssues.filter(i => !i.isLateAddition);
    const prodIssuesCompleted = productionIssues.filter(i => {
      const status = i.status?.toLowerCase() || '';
      return productionIssueCompletedStatuses.some(s => status === s || status.includes(s));
    });
    const prodIssuesMidSprint = productionIssues.filter(i => i.isLateAddition);
    const prodIssuesOverdue = productionIssues.filter(i => {
      if (!i.dueDate) return false;
      const dueDate = new Date(i.dueDate);
      const status = i.status?.toLowerCase() || '';
      const isComplete = productionIssueCompletedStatuses.some(s => status === s || status.includes(s));
      return !isComplete && dueDate < now;
    });
    
    const productionIssuesSummary = {
      committedTickets: prodIssuesCommitted.length,
      totalTicketsAtEnd: productionIssues.length,
      completedTickets: prodIssuesCompleted.length,
      incompleteTickets: productionIssues.length - prodIssuesCompleted.length,
      midSprintAdditions: prodIssuesMidSprint.length,
      overdueTickets: prodIssuesOverdue.length,
      completionRate: productionIssues.length > 0 
        ? Math.round((prodIssuesCompleted.length / productionIssues.length) * 100) 
        : 0
    };
    
    const summary = {
      techStories: techStoriesSummary,
      productionIssues: productionIssuesSummary,
      // Overall metrics (for backward compatibility)
      committedStoryPoints,
      committedTickets: committedTickets.length,
      totalTicketsAtEnd: parentIssues.length,
      completedStoryPoints,
      completedTickets: completedParentIssues.length,
      incompleteTickets: parentIssues.length - completedParentIssues.length,
      midSprintAdditions: midSprintAdditions.length,
      overdueTickets: overdueTickets.length,
      completionRate: parentIssues.length > 0 
        ? Math.round((completedParentIssues.length / parentIssues.length) * 100) 
        : 0,
      totalEstimatedHours: parentIssues.reduce((sum, i) => sum + i.originalEstimate, 0),
      totalLoggedHours: parentIssues.reduce((sum, i) => sum + i.timeSpent, 0)
    };
    
    // Get hoursPerDay from config
    const sprintConfig = database.getSprintConfig();
    const hoursPerDay = sprintConfig?.hoursPerDay || 8;
    
    logger.info('Fetched retro data', { 
      sprintId, 
      sprintName: sprint.name,
      issueCount: processedIssues.length,
      techStoriesCount: techStories.length,
      productionIssuesCount: productionIssues.length
    });
    
    res.json({
      sprint,
      issues: processedIssues,
      techStories,
      productionIssues,
      subtasksByParent,
      summary,
      hoursPerDay
    });
    
  } catch (error) {
    logger.error('Error fetching retro data', { 
      sprintId: req.params.sprintId, 
      error: error.message,
      status: error.response?.status
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
