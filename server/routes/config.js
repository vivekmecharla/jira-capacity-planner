const express = require('express');
const router = express.Router();
const database = require('../services/database');
const zohoClient = require('../services/zohoClient');
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

router.post('/team/bulk', (req, res) => {
  try {
    const { members } = req.body;
    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: 'members array is required' });
    }
    const allMembers = database.bulkAddTeamMembers(members);
    logger.info('Bulk added team members', { count: members.length });
    res.json(allMembers);
  } catch (error) {
    logger.error('Error bulk adding team members', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.put('/team/:accountId', (req, res) => {
  try {
    database.updateTeamMember(req.params.accountId, req.body);
    const members = database.getTeamMembers();
    logger.info('Updated team member', { accountId: req.params.accountId });
    res.json(members);
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

// Holidays - fetched from Zoho (read-only)
router.get('/holidays', async (req, res) => {
  try {
    const { from, to } = req.query;
    
    // Default to current year if no dates provided
    const currentYear = new Date().getFullYear();
    const fromDate = from || `${currentYear}-01-01`;
    const toDate = to || `${currentYear}-12-31`;
    
    if (zohoClient.isConfigured()) {
      try {
        const holidays = await zohoClient.getHolidays(fromDate, toDate);
        logger.debug('Fetched holidays from Zoho', { count: holidays.length });
        res.json(holidays);
        return;
      } catch (zohoError) {
        logger.warn('Zoho API failed, falling back to local database', { error: zohoError.message });
      }
    }
    
    // Fallback to local DB if Zoho not configured or failed
    const holidays = database.getHolidays();
    logger.debug('Using local database for holidays', { count: holidays.length });
    res.json(holidays);
  } catch (error) {
    logger.error('Error fetching holidays', { error: error.message });
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

// Leaves - fetched from Zoho (read-only)
router.get('/leaves', async (req, res) => {
  try {
    const { from, to, email } = req.query;
    
    // Default to current year if no dates provided
    const currentYear = new Date().getFullYear();
    const fromDate = from || `${currentYear}-01-01`;
    const toDate = to || `${currentYear}-12-31`;
    
    if (zohoClient.isConfigured()) {
      try {
        const leaves = await zohoClient.getLeaves(fromDate, toDate, email);
        logger.debug('Fetched leaves from Zoho', { count: leaves.length });
        res.json(leaves);
        return;
      } catch (zohoError) {
        logger.warn('Zoho API failed, falling back to local database', { error: zohoError.message });
      }
    }
    
    // Fallback to local DB if Zoho not configured or failed
    const leaves = database.getLeaves();
    logger.debug('Using local database for leaves', { count: leaves.length });
    res.json(leaves);
  } catch (error) {
    logger.error('Error fetching leaves', { error: error.message });
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

// Check if Zoho is configured and working
router.get('/zoho/status', async (req, res) => {
  const configured = zohoClient.isConfigured();

  if (!configured) {
    return res.json({
      configured: false,
      working: false,
      message: 'Zoho not configured - showing local data'
    });
  }

  // Test if Zoho API actually works by making a small request
  try {
    // Try to fetch holidays for current month to test connectivity
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const fromDate = startOfMonth.toISOString().split('T')[0];
    const toDate = endOfMonth.toISOString().split('T')[0];

    await zohoClient.getHolidays(fromDate, toDate);

    return res.json({
      configured: true,
      working: true,
      message: 'Data synced from Zoho People'
    });
  } catch (error) {
    logger.warn('Zoho API test failed', { error: error.message });
    return res.json({
      configured: true,
      working: false,
      message: 'Zoho configured but not working - showing local data'
    });
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
