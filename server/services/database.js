const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

const defaultData = {
  teamMembers: [],
  holidays: [],
  leaves: [],
  sprintConfig: {
    defaultSprintDays: 8,
    hoursPerDay: 8
  },
  boards: []
};

function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2));
  }
}

function readDb() {
  ensureDbExists();
  const data = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(data);
}

function writeDb(data) {
  ensureDbExists();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Team Members
function getTeamMembers() {
  return readDb().teamMembers || [];
}

function addTeamMember(member) {
  const db = readDb();
  const existing = db.teamMembers.find(m => m.accountId === member.accountId);
  if (existing) {
    Object.assign(existing, member);
  } else {
    db.teamMembers.push({
      ...member,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    });
  }
  writeDb(db);
  return db.teamMembers;
}

function updateTeamMember(accountId, updates) {
  const db = readDb();
  const member = db.teamMembers.find(m => m.accountId === accountId);
  if (member) {
    Object.assign(member, updates);
    writeDb(db);
  }
  return member;
}

function removeTeamMember(accountId) {
  const db = readDb();
  db.teamMembers = db.teamMembers.filter(m => m.accountId !== accountId);
  writeDb(db);
  return db.teamMembers;
}

// Holidays
function getHolidays() {
  return readDb().holidays || [];
}

function addHoliday(holiday) {
  const db = readDb();
  db.holidays.push({
    ...holiday,
    id: Date.now().toString()
  });
  writeDb(db);
  return db.holidays;
}

function removeHoliday(id) {
  const db = readDb();
  db.holidays = db.holidays.filter(h => h.id !== id);
  writeDb(db);
  return db.holidays;
}

// Leaves
function getLeaves() {
  return readDb().leaves || [];
}

function addLeave(leave) {
  const db = readDb();
  db.leaves.push({
    ...leave,
    id: Date.now().toString()
  });
  writeDb(db);
  return db.leaves;
}

function updateLeave(id, updates) {
  const db = readDb();
  const leave = db.leaves.find(l => l.id === id);
  if (leave) {
    Object.assign(leave, updates);
    writeDb(db);
  }
  return leave;
}

function removeLeave(id) {
  const db = readDb();
  db.leaves = db.leaves.filter(l => l.id !== id);
  writeDb(db);
  return db.leaves;
}

// Sprint Config
function getSprintConfig() {
  return readDb().sprintConfig || defaultData.sprintConfig;
}

function updateSprintConfig(config) {
  const db = readDb();
  db.sprintConfig = { ...db.sprintConfig, ...config };
  writeDb(db);
  return db.sprintConfig;
}

// Boards
function getSavedBoards() {
  return readDb().boards || [];
}

function saveBoard(board) {
  const db = readDb();
  const existing = db.boards.find(b => b.id === board.id);
  if (existing) {
    Object.assign(existing, board);
  } else {
    db.boards.push(board);
  }
  writeDb(db);
  return db.boards;
}

module.exports = {
  getTeamMembers,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
  getHolidays,
  addHoliday,
  removeHoliday,
  getLeaves,
  addLeave,
  updateLeave,
  removeLeave,
  getSprintConfig,
  updateSprintConfig,
  getSavedBoards,
  saveBoard
};
