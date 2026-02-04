const axios = require('axios');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ZohoClient');

class ZohoClient {
  constructor() {
    this.baseUrl = process.env.ZOHO_PEOPLE_URL || 'https://people.zoho.com';
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.accountsUrl = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.refreshToken);
  }

  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.isConfigured()) {
      throw new Error('Zoho credentials not configured. Please set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN');
    }

    try {
      logger.debug('Refreshing Zoho access token', { 
        accountsUrl: this.accountsUrl,
        clientIdPrefix: this.clientId?.substring(0, 10) + '...',
        hasRefreshToken: !!this.refreshToken
      });
      
      const response = await axios.post(`${this.accountsUrl}/oauth/v2/token`, null, {
        params: {
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token'
        }
      });

      if (response.data.error) {
        logger.error('Zoho token refresh returned error', { error: response.data.error });
        throw new Error(response.data.error);
      }

      this.accessToken = response.data.access_token;
      // Token typically expires in 1 hour, refresh 5 minutes early
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
      
      logger.debug('Zoho access token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      logger.error('Failed to refresh Zoho access token', { 
        error: error.message,
        status: error.response?.status,
        details: errorDetails
      });
      throw new Error(`Failed to authenticate with Zoho: ${JSON.stringify(errorDetails)}`);
    }
  }

  async makeRequest(endpoint, params = {}) {
    const token = await this.getAccessToken();
    
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`
        },
        params
      });
      return response.data;
    } catch (error) {
      logger.error('Zoho API request failed', { endpoint, error: error.message });
      throw error;
    }
  }

  /**
   * Fetch holidays from Zoho People
   * @param {string} fromDate - Start date in YYYY-MM-DD format
   * @param {string} toDate - End date in YYYY-MM-DD format
   * @returns {Array} List of holidays
   */
  async getHolidays(fromDate, toDate) {
    if (!this.isConfigured()) {
      logger.warn('Zoho not configured, returning empty holidays');
      return [];
    }

    try {
      const response = await this.makeRequest('/people/api/leave/v2/holidays/get', {
        from: fromDate,
        to: toDate,
        dateFormat: 'yyyy-MM-dd'
      });

      if (response.data && Array.isArray(response.data)) {
        const holidays = response.data.map((holiday, index) => ({
          id: `zoho-holiday-${holiday.Id || index}-${holiday.Date}`,
          name: holiday.Name || holiday.Holiday,
          date: this.parseZohoDate(holiday.Date),
          source: 'zoho'
        }));
        
        logger.info('Fetched holidays from Zoho', { count: holidays.length });
        return holidays;
      }
      
      return [];
    } catch (error) {
      logger.error('Failed to fetch holidays from Zoho', { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch leave records from Zoho People
   * @param {string} fromDate - Start date in YYYY-MM-DD format  
   * @param {string} toDate - End date in YYYY-MM-DD format
   * @param {string} employeeEmail - Optional employee email filter
   * @returns {Array} List of approved leaves
   */
  async getLeaves(fromDate, toDate, employeeEmail = null) {
    if (!this.isConfigured()) {
      logger.warn('Zoho not configured, returning empty leaves');
      return [];
    }

    try {
      // Use the correct endpoint for leave records
      const endpoint = '/api/v2/leavetracker/leaves/records';
      const response = await this.makeRequest(endpoint);

      if (response.records && typeof response.records === 'object') {
        const leaves = [];
        
        for (const [recordId, leaveData] of Object.entries(response.records)) {
          // Only include approved leaves
          if (leaveData.ApprovalStatus === 'Approved') {
            // Check if leave falls within date range
            const leaveStart = this.parseZohoDate(leaveData.From);
            const leaveEnd = this.parseZohoDate(leaveData.To);
            
            if (leaveStart && leaveEnd && 
                leaveStart <= toDate && leaveEnd >= fromDate) {
              
              const leave = {
                id: `zoho-leave-${recordId}`,
                memberName: leaveData.Employee || leaveData.EmployeeName,
                employeeEmail: leaveData.TeamEmailID || leaveData.EmployeeEmail,
                startDate: leaveStart,
                endDate: leaveEnd,
                reason: leaveData.Reason || leaveData.Leavetype,
                leaveType: leaveData.Leavetype,
                isHalfDay: this.isHalfDayLeave(leaveData),
                isUnplanned: false,
                source: 'zoho',
                status: leaveData.ApprovalStatus
              };
              
              // Filter by employee email if provided
              if (!employeeEmail || leave.employeeEmail === employeeEmail) {
                leaves.push(leave);
              }
            }
          }
        }
        
        logger.info('Fetched leaves from Zoho', { count: leaves.length });
        return leaves;
      }
      
      return [];
    } catch (error) {
      logger.error('Failed to fetch leaves from Zoho', { error: error.message });
      throw error;
    }
  }

  // Helper to determine if leave is half-day
  isHalfDayLeave(leaveData) {
    if (leaveData.Unit === 'Half day') return true;
    if (leaveData.Days) {
      // Check if any day has LeaveCount < 1
      for (const day of Object.values(leaveData.Days)) {
        if (parseFloat(day.LeaveCount || 0) < 1) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Parse Zoho date format to ISO date string
   * Zoho can return dates in various formats like "dd-MMM-yyyy" or "yyyy-MM-dd"
   */
  parseZohoDate(dateStr) {
    if (!dateStr) return null;
    
    // If already in ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.split('T')[0];
    }
    
    // Parse "dd-MMM-yyyy" format (e.g., "15-Jan-2025")
    const months = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const match = dateStr.match(/(\d{1,2})-(\w{3})-(\d{4})/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = months[match[2]];
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
    
    // Fallback: try to parse with Date
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }

  /**
   * Get all employees from Zoho People
   */
  async getEmployees() {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const response = await this.makeRequest('/people/api/forms/employee/getRecords', {
        sIndex: 1,
        limit: 200
      });

      if (response.response && response.response.result) {
        return response.response.result.map(record => {
          const empData = Object.values(record)[0];
          return {
            id: empData.EmployeeID || empData.Zoho_ID,
            name: empData.EmployeeName || `${empData.FirstName} ${empData.LastName}`,
            email: empData.EmailID || empData.Email,
            department: empData.Department
          };
        });
      }
      
      return [];
    } catch (error) {
      logger.error('Failed to fetch employees from Zoho', { error: error.message });
      throw error;
    }
  }
}

module.exports = new ZohoClient();
