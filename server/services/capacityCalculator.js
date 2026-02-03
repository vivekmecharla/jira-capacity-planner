const database = require('./database');
const jiraClient = require('./jiraClient');
const { createLogger } = require('../utils/logger');
const logger = createLogger('CapacityCalculator');

class CapacityCalculator {
  
  calculateWorkingDays(startDate, endDate, holidays = []) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    
    const holidayDates = holidays.map(h => new Date(h.date).toDateString());
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const dateString = d.toDateString();
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.includes(dateString)) {
        workingDays++;
      }
    }
    
    return workingDays;
  }

  calculateMemberAvailability(member, sprintStart, sprintEnd, holidays, leaves, configuredSprintDays) {
    const config = database.getSprintConfig();
    const hoursPerDay = config.hoursPerDay || 8;
    
    // Get holidays during sprint
    const sprintHolidays = holidays.filter(h => 
      new Date(h.date) >= new Date(sprintStart) &&
      new Date(h.date) <= new Date(sprintEnd)
    );
    
    // Use configured sprint days instead of calculating from dates
    // This allows setting 8 working days for a 2-week sprint
    const totalWorkingDays = configuredSprintDays || config.defaultSprintDays || 8;
    
    // Calculate holiday days (count only weekdays)
    let holidayDays = 0;
    sprintHolidays.forEach(holiday => {
      const holidayDate = new Date(holiday.date);
      const dayOfWeek = holidayDate.getDay();
      // Count only if it's a weekday (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        holidayDays++;
      }
    });
    
    // Get member's leaves during sprint
    const memberLeaves = leaves.filter(l => 
      l.accountId === member.accountId &&
      new Date(l.startDate) <= new Date(sprintEnd) &&
      new Date(l.endDate) >= new Date(sprintStart)
    );
    
    // Calculate leave days (support half-day leaves)
    let leaveDays = 0;
    memberLeaves.forEach(leave => {
      const leaveStart = new Date(Math.max(new Date(leave.startDate), new Date(sprintStart)));
      const leaveEnd = new Date(Math.min(new Date(leave.endDate), new Date(sprintEnd)));
      const workingDays = this.calculateWorkingDays(leaveStart, leaveEnd, holidays);
      
      // Check if it's a half-day leave
      if (leave.isHalfDay) {
        leaveDays += 0.5; // Half day counts as 0.5
      } else {
        leaveDays += workingDays;
      }
    });
    
    const availableDays = Math.max(0, totalWorkingDays - holidayDays - leaveDays);
    const availableHours = availableDays * hoursPerDay;
    
    // Apply role-based allocation factor based on role
    let roleAllocation = member.roleAllocation;
    
    // Set default allocation based on role if not explicitly set
    if (roleAllocation === undefined || roleAllocation === null) {
      switch(member.role) {
        case 'Dev Lead':
        case 'QA Lead':
          roleAllocation = 0.5;
          break;
        case 'Sprint Head':
          roleAllocation = 0;
          break;
        default:
          roleAllocation = 1;
      }
    }
    
    const allocatedHours = availableHours * roleAllocation;
    
    logger.debug(`Member ${member.displayName}: Total=${totalWorkingDays}, Holidays=${holidayDays}, Leaves=${leaveDays}, Available=${availableDays}, Role=${member.role || 'Developer'}, Allocation=${roleAllocation}, Allocated=${allocatedHours}h`);
    
    return {
      totalWorkingDays,
      holidayDays,
      leaveDays,
      availableDays,
      availableHours,
      allocatedHours,
      roleAllocation,
      leaves: memberLeaves
    };
  }

  calculateTeamCapacity(teamMembers, sprintStart, sprintEnd) {
    const holidays = database.getHolidays().filter(h => 
      new Date(h.date) >= new Date(sprintStart) &&
      new Date(h.date) <= new Date(sprintEnd)
    );
    const leaves = database.getLeaves();
    const config = database.getSprintConfig();
    const configuredSprintDays = config.defaultSprintDays || 8;
    
    logger.debug('Using configured sprint days:', configuredSprintDays);
    
    const memberCapacities = teamMembers.map(member => {
      logger.debug(`Processing member: ${member.displayName}, Role: ${member.role}, RoleAllocation: ${member.roleAllocation}`);
      const availability = this.calculateMemberAvailability(
        member, sprintStart, sprintEnd, holidays, leaves, configuredSprintDays
      );
      
      return {
        ...member,
        ...availability
      };
    });
    
    const totalCapacity = memberCapacities.reduce((sum, m) => sum + m.allocatedHours, 0);
    const totalAvailableDays = memberCapacities.reduce((sum, m) => sum + m.availableDays, 0);
    
    return {
      members: memberCapacities,
      totalCapacity,
      totalAvailableDays,
      holidays,
      sprintConfig: config
    };
  }

  async calculateWorkLoggedBetweenDates(issueKey, sprintStartDate, sprintEndDate) {
    try {
      const startDateMs = new Date(sprintStartDate).getTime();
      const endDateMs = new Date(sprintEndDate).getTime();
      
      const workLogs = await jiraClient.getWorkLogs(issueKey, startDateMs, endDateMs);
      
      let totalLoggedHours = 0;
      if (workLogs && workLogs.worklogs) {
        workLogs.worklogs.forEach(worklog => {
          const startedDate = new Date(worklog.started);
          if (startedDate >= new Date(sprintStartDate) && startedDate <= new Date(sprintEndDate)) {
            totalLoggedHours += (worklog.timeSpentSeconds || 0) / 3600;
          }
        });
      }
      
      return totalLoggedHours;
    } catch (error) {
      logger.error(`Error fetching work logs for ${issueKey}:`, error.message);
      return 0;
    }
  }

  calculateAssignedWork(issues, teamMembers, sprintStartDate = null, sprintName = null, excludeDone = false, sprintEndDate = null, sprintState = null, worklogsByIssue = {}) {
    const memberWork = {};
    
    // Build a map of member roles for quick lookup
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
    
    // Initialize work tracking for each member
    teamMembers.forEach(member => {
      memberWork[member.accountId] = {
        ...member,
        assignedIssues: [],
        totalEstimatedHours: 0,
        totalLoggedHours: 0,
        totalRemainingHours: 0,
        totalCommittedHours: 0
      };
    });
    
    // Add unassigned bucket
    memberWork['unassigned'] = {
      accountId: 'unassigned',
      displayName: 'Unassigned',
      assignedIssues: [],
      totalEstimatedHours: 0,
      totalLoggedHours: 0,
      totalRemainingHours: 0,
      totalCommittedHours: 0
    };
    
    // First pass: collect all subtasks by parent key
    const subtasksByParent = {};
    issues.forEach(issue => {
      if (issue.fields.issuetype?.subtask === true) {
        const parentKey = issue.fields.parent?.key;
        if (parentKey) {
          if (!subtasksByParent[parentKey]) {
            subtasksByParent[parentKey] = [];
          }
          const estimate = (issue.fields.timeoriginalestimate || 0) / 3600;
          subtasksByParent[parentKey].push({
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
    
    // Process each issue
    issues.forEach((issue, index) => {
      const assigneeId = issue.fields.assignee?.accountId || 'unassigned';
      const originalEstimate = (issue.fields.timeoriginalestimate || 0) / 3600;
      const timeSpent = (issue.fields.timespent || 0) / 3600;
      const remainingEstimate = (issue.fields.timeestimate || 0) / 3600;
      const issueType = issue.fields.issuetype?.name;
      
      // Try multiple common story points field IDs
      const storyPoints = issue.fields.customfield_10016 
        || issue.fields.customfield_10026 
        || issue.fields.customfield_10004
        || issue.fields.customfield_10034
        || issue.fields['Story Points']
        || issue.fields.storyPoints
        || null;
      
            
      // Determine if issue is completed based on status
      // For Production Issues/Bugs, completed statuses from workflow (green boxes):
      const completedStatuses = [
        'Done',
        'Deployed Pending Monitoring',
        'Deployed - Monitoring Completed',
        'Not a Bug',
        'Duplicate',
        'Fix Not Needed',
        'Enhancement Completed'
      ];
      const statusName = issue.fields.status?.name || '';
      const isCompleted = completedStatuses.some(s => s.toLowerCase() === statusName.toLowerCase());
      
      // Skip Done issues if excludeDone flag is set (for Sprint Planning)
      if (excludeDone && isCompleted) {
        return; // Skip this issue entirely
      }
      
      // Detect if ticket was carried over from previous sprint and if it's a late addition
      // Carryover = moved from another sprint BEFORE sprint started
      // Late = added to sprint AFTER sprint started (mutually exclusive with carryover)
      let isCarryover = false;
      let isLateAddition = false;
      const changelog = issue.changelog;
      const issueCreatedDate = new Date(issue.fields.created);
      let addedToSprintDate = null;
      
      if (changelog && changelog.histories) {
        for (const history of changelog.histories) {
          for (const item of history.items || []) {
            // Only consider sprint changes that added the issue TO the current sprint
            if (item.field === 'Sprint' && item.to && 
                sprintName && item.toString?.includes(sprintName)) {
              addedToSprintDate = new Date(history.created);
              
              // Check if added after sprint started - this is a LATE addition
              if (sprintStartDate && addedToSprintDate > sprintStartDate) {
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
      if (!addedToSprintDate && sprintStartDate && issueCreatedDate > sprintStartDate) {
        isLateAddition = true;
      }
      
      // Calculate Dev and QA estimates from subtasks for parent issues
      let devEstimate = 0;
      let qaEstimate = 0;
      const childSubtasks = subtasksByParent[issue.key] || [];
      
      const isSubtaskType = issue.fields.issuetype?.subtask === true;
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
      } else if (childSubtasks.length > 0) {
        // For parent issues with subtasks, aggregate from subtasks
        childSubtasks.forEach(st => {
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
      
      // For parent issues, total estimate is sum of subtask estimates
      // If no subtasks, use the issue's own estimate
      const totalEstimateFromSubtasks = devEstimate + qaEstimate;
      const effectiveEstimate = totalEstimateFromSubtasks > 0 ? totalEstimateFromSubtasks : originalEstimate;
      
      // Calculate work logged from worklogs between sprint dates
      // For sprint planning/capacity, we only want work logged DURING this sprint
      let workLogged = 0;
      const issueWorklogs = worklogsByIssue[issue.key] || [];
      if (sprintState === 'future') {
        // Future sprints have 0 work logged
        workLogged = 0;
      } else if (issueWorklogs.length > 0) {
        // Filter worklogs to only those within sprint dates (compare dates only, ignore time)
        // Normalize sprint dates to start of day for comparison
        const sprintStartDateOnly = sprintStartDate ? new Date(sprintStartDate.getFullYear(), sprintStartDate.getMonth(), sprintStartDate.getDate()) : null;
        const sprintEndDateOnly = sprintEndDate ? new Date(sprintEndDate.getFullYear(), sprintEndDate.getMonth(), sprintEndDate.getDate(), 23, 59, 59, 999) : null;
        
        issueWorklogs.forEach(wl => {
          const started = new Date(wl.started);
          // Normalize worklog date to start of day for comparison
          const startedDateOnly = new Date(started.getFullYear(), started.getMonth(), started.getDate());
          const startCheck = sprintStartDateOnly ? startedDateOnly >= sprintStartDateOnly : true;
          const endCheck = sprintEndDateOnly ? startedDateOnly <= sprintEndDateOnly : true;
          if (startCheck && endCheck) {
            workLogged += (wl.timeSpentSeconds || 0) / 3600;
          }
        });
      }
      // NOTE: Do NOT fallback to timeSpent - it includes work from ALL sprints
      // If worklogs aren't available, workLogged stays 0 for this sprint
      
      // Start date field - use the specific custom field identified
      const startDate = issue.fields.customfield_12939 || null;
      
      const issueData = {
        key: issue.key,
        summary: issue.fields.summary,
        status: statusName,
        issueType: issueType,
        priority: issue.fields.priority?.name,
        storyPoints: storyPoints,
        originalEstimate,
        devEstimate,
        qaEstimate,
        effectiveEstimate,
        timeSpent,
        workLogged,
        remainingEstimate,
        parentKey: issue.fields.parent?.key,
        isCarryover,
        isLateAddition,
        hasSubtasks: childSubtasks.length > 0,
        isSubtask: issue.fields.issuetype?.subtask === true,
        isCompleted,
        startDate: startDate,
        dueDate: issue.fields.duedate || null,
        created: issue.fields.created || null
      };
      
      // Include both remaining estimate and logged work for ALL tickets (including late additions)
      // This ensures utilization increases when tickets are added mid-sprint
      // Only use workLogged (which is filtered to sprint dates), NOT timeSpent (which includes all time ever logged)
      const committedForThisIssue = remainingEstimate + workLogged;
      
      if (memberWork[assigneeId]) {
        memberWork[assigneeId].assignedIssues.push(issueData);
        memberWork[assigneeId].totalEstimatedHours += remainingEstimate;
        memberWork[assigneeId].totalLoggedHours += workLogged;
        memberWork[assigneeId].totalRemainingHours += remainingEstimate;
        memberWork[assigneeId].totalCommittedHours += committedForThisIssue;
      } else {
        memberWork['unassigned'].assignedIssues.push(issueData);
        memberWork['unassigned'].totalEstimatedHours += remainingEstimate;
        memberWork['unassigned'].totalLoggedHours += workLogged;
        memberWork['unassigned'].totalRemainingHours += remainingEstimate;
        memberWork['unassigned'].totalCommittedHours += committedForThisIssue;
      }
    });
    
    return memberWork;
  }

  calculateSprintPlanning(teamCapacity, assignedWork) {
    const planning = [];
    const config = teamCapacity.sprintConfig || {};
    const hoursPerDay = config.hoursPerDay || 8;
    
    // Include all members (including Sprint Head with 0 allocation)
    teamCapacity.members.forEach(member => {
      const work = assignedWork[member.accountId] || {
        assignedIssues: [],
        totalEstimatedHours: 0,
        totalLoggedHours: 0,
        totalRemainingHours: 0,
        totalCommittedHours: 0
      };
      
      const availableHours = member.allocatedHours !== undefined ? member.allocatedHours : member.availableHours;
      // Use totalCommittedHours which includes logged work for non-late tickets
      // This ensures utilization doesn't decrease as people log work
      const committedHours = work.totalCommittedHours;
      const remainingCapacity = availableHours - committedHours;
      const utilizationPercent = availableHours > 0 
        ? Math.round((committedHours / availableHours) * 100) 
        : (committedHours > 0 ? 100 : 0);
      
      planning.push({
        member: {
          accountId: member.accountId,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl
        },
        availability: {
          totalDays: member.totalWorkingDays,
          leaveDays: member.leaveDays,
          availableDays: member.availableDays,
          availableHours: member.availableHours,
          allocatedHours: member.allocatedHours,
          roleAllocation: member.roleAllocation,
          role: member.role,
          leaves: member.leaves
        },
        work: {
          assignedIssues: work.assignedIssues,
          totalEstimatedHours: work.totalEstimatedHours,
          // UI: "Work Allocated" - includes remaining + logged work for non-late tickets
          workAllocated: work.totalCommittedHours,
          totalCommittedHours: work.totalCommittedHours, // Keep for backward compatibility
          totalLoggedHours: work.totalLoggedHours,
          totalRemainingHours: work.totalRemainingHours,
          issueCount: work.assignedIssues.length
        },
        capacity: {
          // UI: "Work Allocated" column value
          workAllocated: committedHours,
          committedHours, // Keep for backward compatibility
          // UI: "Available Bandwidth" column value
          availableBandwidth: remainingCapacity,
          remainingCapacity, // Keep for backward compatibility
          utilizationPercent,
          isOvercommitted: remainingCapacity < 0
        }
      });
    });
    
    // Add unassigned work
    if (assignedWork['unassigned'] && assignedWork['unassigned'].assignedIssues.length > 0) {
      planning.push({
        member: {
          accountId: 'unassigned',
          displayName: 'Unassigned',
          avatarUrl: null
        },
        availability: null,
        work: {
          assignedIssues: assignedWork['unassigned'].assignedIssues,
          totalEstimatedHours: assignedWork['unassigned'].totalEstimatedHours,
          workAllocated: assignedWork['unassigned'].totalCommittedHours,
          totalCommittedHours: assignedWork['unassigned'].totalCommittedHours,
          totalLoggedHours: assignedWork['unassigned'].totalLoggedHours,
          totalRemainingHours: assignedWork['unassigned'].totalRemainingHours,
          issueCount: assignedWork['unassigned'].assignedIssues.length
        },
        capacity: null
      });
    }
    
    // Calculate totals - exclude subtasks to avoid double counting
    // Use effectiveEstimate from parent issues (which sums subtask estimates)
    const allIssues = planning.flatMap(p => p.work.assignedIssues);
    const parentIssues = allIssues.filter(i => !i.isSubtask);
    
    // Calculate Dev and QA committed hours from parent issues only
    // For non-late tickets: include logged work (remaining + logged = original commitment)
    // For late tickets: only count remaining estimate (not part of original commitment)
    let totalDevCommitted = 0;
    let totalQaCommitted = 0;
    
    parentIssues.forEach(issue => {
      const workLogged = issue.workLogged || 0;
      const isLate = issue.isLateAddition;
      
      if (issue.hasSubtasks) {
        // For issues with subtasks, use devEstimate/qaEstimate
        totalDevCommitted += issue.devEstimate || 0;
        totalQaCommitted += issue.qaEstimate || 0;
        // Add logged work proportionally for non-late tickets
        if (!isLate) {
          const totalEstimate = (issue.devEstimate || 0) + (issue.qaEstimate || 0);
          if (totalEstimate > 0) {
            totalDevCommitted += workLogged * ((issue.devEstimate || 0) / totalEstimate);
            totalQaCommitted += workLogged * ((issue.qaEstimate || 0) / totalEstimate);
          } else {
            totalDevCommitted += workLogged; // Default to dev if no estimates
          }
        }
      } else {
        // No subtasks - use remaining estimate + logged work for non-late, default to Dev
        const committed = isLate ? (issue.remainingEstimate || 0) : (issue.remainingEstimate || 0) + workLogged;
        totalDevCommitted += committed;
      }
    });
    
    const totalCommitted = totalDevCommitted + totalQaCommitted;
    
    const totals = {
      // UI: "Availability" column total
      totalTeamCapacity: teamCapacity.totalCapacity,
      totalTeamCapacityDays: teamCapacity.totalCapacity / hoursPerDay,
      // UI: "Work Allocated" column total
      totalWorkAllocated: totalCommitted,
      totalCommitted, // Keep for backward compatibility
      totalCommittedDays: totalCommitted / hoursPerDay,
      totalDevCommitted,
      totalDevCommittedDays: totalDevCommitted / hoursPerDay,
      totalQaCommitted,
      totalQaCommittedDays: totalQaCommitted / hoursPerDay,
      // UI: "Available Bandwidth" column total
      totalAvailableBandwidth: 0,
      totalRemaining: 0, // Keep for backward compatibility
      totalRemainingDays: 0,
      totalStoryPoints: parentIssues.reduce((s, i) => s + (i.storyPoints || 0), 0),
      totalIssues: parentIssues.length,
      hoursPerDay
    };
    totals.totalRemaining = totals.totalTeamCapacity - totals.totalCommitted;
    totals.totalAvailableBandwidth = totals.totalRemaining;
    totals.totalRemainingDays = totals.totalRemaining / hoursPerDay;
    totals.teamUtilization = totals.totalTeamCapacity > 0 
      ? Math.round((totals.totalCommitted / totals.totalTeamCapacity) * 100)
      : 0;
    
    return {
      members: planning,
      totals,
      holidays: teamCapacity.holidays,
      sprintConfig: teamCapacity.sprintConfig
    };
  }
}

module.exports = new CapacityCalculator();
