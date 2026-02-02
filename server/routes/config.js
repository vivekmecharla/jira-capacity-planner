const express = require('express');
const router = express.Router();
const database = require('../services/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ConfigRoutes');

// Team Members
router.get('/team', (req, res) => {
  try {
    const members = database.getTeamMembers();
    logger.debug('Fetched team members', { count: members.length });
    res.json(members);
  } catch (error) {
    logger.error('Error fetching team members', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/team', (req, res) => {
  try {
    const members = database.addTeamMember(req.body);
    logger.info('Added team member', { accountId: req.body.accountId, displayName: req.body.displayName });
    res.json(members);
  } catch (error) {
    logger.error('Error adding team member', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.put('/team/:accountId', (req, res) => {
  try {
    const member = database.updateTeamMember(req.params.accountId, req.body);
    logger.info('Updated team member', { accountId: req.params.accountId });
    res.json(member);
  } catch (error) {
    logger.error('Error updating team member', { accountId: req.params.accountId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.delete('/team/:accountId', (req, res) => {
  try {
    const members = database.removeTeamMember(req.params.accountId);
    logger.info('Removed team member', { accountId: req.params.accountId });
    res.json(members);
  } catch (error) {
    logger.error('Error removing team member', { accountId: req.params.accountId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Holidays
router.get('/holidays', (req, res) => {
  try {
    const holidays = database.getHolidays();
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/holidays', (req, res) => {
  try {
    const holidays = database.addHoliday(req.body);
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/holidays/:id', (req, res) => {
  try {
    const holidays = database.removeHoliday(req.params.id);
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leaves
router.get('/leaves', (req, res) => {
  try {
    const leaves = database.getLeaves();
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/leaves', (req, res) => {
  try {
    const leaves = database.addLeave(req.body);
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/leaves/:id', (req, res) => {
  try {
    const leave = database.updateLeave(req.params.id, req.body);
    res.json(leave);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/leaves/:id', (req, res) => {
  try {
    const leaves = database.removeLeave(req.params.id);
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sprint Config
router.get('/sprint', (req, res) => {
  try {
    const config = database.getSprintConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/sprint', (req, res) => {
  try {
    const config = database.updateSprintConfig(req.body);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Saved Boards
router.get('/boards', (req, res) => {
  try {
    const boards = database.getSavedBoards();
    res.json(boards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/boards', (req, res) => {
  try {
    const boards = database.saveBoard(req.body);
    res.json(boards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
