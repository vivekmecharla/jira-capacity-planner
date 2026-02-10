# Jira Capacity Planner

A comprehensive sprint management tool that integrates with Jira to provide capacity planning, team timeline visualization, daily standup boards, and sprint retrospectives.

## Features

### Sprint Planning Dashboard
- **Team Capacity Overview**: Visual pie charts showing team capacity, sprint overview, and member distribution
- **Capacity vs Committed**: Track available hours against committed work per team member
- **Dev & QA Estimate Split**: Automatic separation of Dev and QA estimates based on subtask naming or assignee roles
- **Utilization Tracking**: Color-coded progress bars (green < 80%, yellow 80-100%, red > 100%)
- **Carryover & Late Addition Highlighting**: Orange for carryovers, yellow for mid-sprint additions
- **Collapsible Sections**: Expandable leaves and holidays sections with team member details

### Team Timeline
- **Gantt-Style Visualization**: Visual timeline showing task assignments across the sprint duration
- **Task Bars**: Color-coded bars showing each task's duration from start date to due date
- **Member Grouping**: Tasks grouped by team member for easy workload visualization
- **Interactive**: Click task bars to view details in a popup modal

### Standup Board
- **Kanban-Style Layout**: Three columns - TO DO, IN PROGRESS, DONE
- **Subtask-Focused View**: Shows subtasks as primary cards with parent issue info embedded
- **Time Tracking Progress**: Visual progress bar showing work logged vs remaining time
- **Team Member Sidebar**: Filter board by individual team members
- **Real-Time Status**: Cards categorized by subtask status

### Sprint Retrospective
- **Dual Metrics View**: Separate tracking for Tech Stories and Production Issues
- **Committed vs Completed**: Compare sprint commitments against actual completions
- **Late Additions Tracking**: Highlight tickets added mid-sprint
- **Overdue Analysis**: Track days overdue for incomplete tickets
- **Completion Rates**: Percentage completion metrics per category
- **Member-wise Breakdown**: Issues grouped by team member, then by parent story with subtasks
- **Member Work Overview**: Visual bar charts showing team member capacity and work tracking
  - **Team Summary Chart**: Vertical bar chart with member names on X-axis displaying available hours, work allocated, and work logged
  - **Individual Breakdown**: Horizontal bar charts per member with collapsible details
  - **Work Tracking Metrics**: Logged vs allocated percentage with color-coded progress indicators
  - **Mutually Exclusive Views**: Switch between team summary and individual member views

### Issue Management
- **Tech Stories Table**: Stories, Tasks, and Technical Tasks with Dev/QA estimate columns
- **Production Issues Table**: Bugs, Incidents, and Production Issues with priority tracking
- **Expandable Subtasks**: View subtasks nested under parent issues
- **Direct Jira Links**: Click any issue key to open in Jira
- **Workflow-Based Status**: Completion status based on your Jira workflow

### Team & Configuration
- **Team Member Management**: Add/remove team members with role assignments (Developer, QA, Dev Lead, QA Lead, Sprint Head)
- **Board Assignments**: Assign team members to specific boards/projects for filtered capacity planning
- **Board-Based Filtering**: View only team members assigned to the selected board across all features
- **Holiday Calendar**: Configure company-wide holidays
- **Leave Management**: Track individual team member leaves with sorting and editing capabilities
- **Sprint Settings**: Configure working days per sprint and hours per day

### Leave Management Features
- **Universal Leave Editor**: Edit leaves directly from any page (Standup, Sprint Planning, Active Sprint, Sprint Retro, Timeline, Holidays & Leaves)
- **Leave Sorting**: Automatic sorting by date (latest first) across all leave displays
- **Worklog Leave Check**: Automatically fetches work logs from the previous working day if user was on leave
- **Smart Leave Detection**: Considers full-day leave and first-half-day leave when determining work log dates

### Server-Side Logging
- **Structured Logging**: All API requests and errors logged with timestamps
- **Log Rotation**: Automatic log file rotation to prevent disk space issues
- **Debug Support**: Configurable log levels for troubleshooting

## Prerequisites

- Node.js 16+ installed
- Jira Cloud account with API access
- Jira API token

## Installation

### 1. Clone and Install Dependencies

```bash
cd jira-capacity-planner
npm run install-all
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your Jira credentials:

```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
PORT=3001
```

### 3. Get Your Jira API Token

1. Go to [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Name it (e.g., "Capacity Planner")
4. Copy the token to your `.env` file

> **Security Note**: For read-only access, create a dedicated Jira user with only "Browse Projects" permission.

### 4. Run the Application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## Usage

### Preconditions

> **⚠️ Important**: For all features to work properly, ensure the following in your Jira setup:
> 
> 1. **Original Estimate**: All subtasks must have the "Original Estimate" field filled (Time Tracking section in Jira)
> 2. **Start Date**: All subtasks should have a start date configured
> 3. **Due Date**: All subtasks should have a due date configured
> 4. **Daily Work Logging**: Team members should log their work daily on their assigned subtasks
> 
> Without these fields properly configured, capacity calculations, timeline visualization, and time tracking progress will be inaccurate.

### 1. Initial Setup

1. **Configure Team Members** (Team tab)
   - Add team members from your Jira project
   - Assign roles (Developer, QA, Dev Lead, QA Lead, Sprint Head)
   - **Assign team members to specific boards** for filtered capacity planning
   - Use the Edit button to assign members to multiple boards/projects

2. **Add Holidays** (Holidays & Leaves tab)
   - Add company-wide holidays
   - Add individual team member leaves
   - **Edit leaves directly** from any page using the manage leaves button

3. **Sprint Settings** (Settings tab)
   - Set working days per sprint (default: 8)
   - Set working hours per day (default: 8)

### 2. Sprint Planning

1. Select your **Project**, **Board**, and **Sprint** from the header dropdowns
2. View the **Sprint Planning** tab for:
   - Team capacity pie charts (filtered by selected board)
   - Per-member capacity vs committed work (only members assigned to board)
   - **Team Capacity table** with optional work logged column (toggle with "📊 Work Logged" button)
   - Tech Stories and Production Issues tables

**Note**: When a board is selected, only team members assigned to that board are shown in capacity calculations and planning data.

### 3. Team Timeline

1. Navigate to the **Timeline** tab
2. View Gantt-style visualization of task assignments
3. Click on task bars to view detailed information
4. Identify scheduling conflicts and workload distribution

### 4. Daily Standup

1. Navigate to the **Standup** tab
2. Use the member sidebar to filter by team member
3. Review subtasks in TO DO, IN PROGRESS, and DONE columns
4. Check time tracking progress on each card

### 5. Sprint Retrospective

1. Navigate to the **Sprint Retro** tab
2. Review committed vs completed metrics
3. Analyze late additions and overdue items
4. **Member-wise Breakdown**: View all issues grouped by team member, then by parent story
5. **Member Work Overview**: 
   - View the vertical bar chart showing team-wide capacity and work allocation
   - Switch to "Individual Breakdown" to see detailed per-member charts
   - Review logged vs allocated percentages for each team member
   - Expand individual member cards to see detailed work tracking

## Capacity Calculation

### Team Capacity Formula

```
Working Days = Sprint Duration - Weekends - Holidays
Available Days = Working Days - Leave Days
Available Hours = Available Days × Hours per Day
```

### Utilization Calculation

```
Committed Hours = Sum of Original Estimates (excluding subtasks to avoid double-counting)
Utilization % = (Committed Hours / Available Hours) × 100
```

### Dev/QA Classification

Subtasks are classified based on:
1. **Name prefix**: "Dev" → Dev estimate, "QA" → QA estimate
2. **Assignee role**: Falls back to team member's configured role
3. **Default**: Unclassified subtasks default to Dev

> **Naming Convention**: For accurate tracking, prefix subtasks with "Dev" or "QA":
> - `Dev - Implement API endpoint`
> - `QA - Write test cases`

### Status Indicators

| Color | Utilization | Meaning |
|-------|-------------|---------|
| 🟢 Green | < 80% | Healthy capacity |
| 🟡 Yellow | 80-100% | Near capacity |
| 🔴 Red | > 100% | Overcommitted |

| Color | Logged vs Allocated | Meaning |
|-------|---------------------|---------|
| 🟢 Green | ≥ 100% | Work completed or over |
| 🟡 Yellow | 80-99% | Nearly completed |
| 🔴 Red | < 80% | Significant gap in work logging |

## Data Storage

- **Configuration**: Stored in `server/data/db.json` (auto-created)
- **Logs**: Stored in `logs/` directory with automatic rotation

## API Endpoints

### Jira
- `GET /api/jira/projects` - List all projects
- `GET /api/jira/boards` - List all boards
- `GET /api/jira/boards/:id/sprints` - Get sprints for a board
- `GET /api/jira/sprints/:id/issues` - Get issues in a sprint

### Configuration
- `GET/POST /api/config/team` - Team members
- `GET/POST/DELETE /api/config/holidays` - Holidays
- `GET/POST/DELETE /api/config/leaves` - Leaves
- `GET/PUT /api/config/sprint` - Sprint settings

### Data
- `GET /api/capacity/sprint/:id?boardId=X` - Sprint planning data (filtered by board)
- `GET /api/retro/sprint/:id?boardId=X` - Retrospective data (filtered by board)
- `GET /api/jira/users/:accountId/worklogs` - User work logs with leave-aware date calculation

## Troubleshooting

### "Failed to connect to Jira"
- Verify `.env` credentials are correct
- Ensure API token is valid and not expired
- Check JIRA_BASE_URL includes `https://`

### "No team members configured"
- Add team members in the Team tab first
- If a board is selected, ensure team members are assigned to that board

### "No team members assigned to this board"
- Edit team members to assign them to the selected board
- Members without board assignments appear in all boards (backward compatible)

### Work logs showing wrong date
- Check if the team member was on leave on the previous working day
- The system automatically fetches work logs from the last non-leave working day

### Missing estimates or dates
- Ensure subtasks have Original Estimate, Start Date, and Due Date in Jira

### Timeline not showing tasks
- Verify subtasks have both start date and due date configured

### Standup board empty
- Ensure the sprint has subtasks assigned to team members

## Known Issues


### Sprint Selection & Refresh
- **Page Crash**: Changing sprint while on tabs other than Sprint Planning/Active Sprints/Sprint Retro causes the page to crash
- **Refresh Button**: Clicking refresh on tabs other than Sprint Planning causes the page to crash

> **Note**: These issues are known and will be fixed in future updates. The Timeline component is marked as "Work in Progress" (WIP) to indicate its current state.

## License

NA
