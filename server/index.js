require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { logger, requestLogger } = require('./utils/logger');
const jiraRoutes = require('./routes/jira');
const configRoutes = require('./routes/config');
const capacityRoutes = require('./routes/capacity');
const retroRoutes = require('./routes/retro');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use(requestLogger);

// Routes
app.use('/api/jira', jiraRoutes);
app.use('/api/config', configRoutes);
app.use('/api/capacity', capacityRoutes);
app.use('/api/retro', retroRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
