'use strict';

const { ActivityLog } = require('../models');

/**
 * Fire-and-forget activity logging helper.
 * Callers must NOT await this — logging failure should never crash the app.
 */
const logActivity = async ({
  employeeId,
  actionType,
  actionDescription,
  targetType,
  targetId,
  metadata,
  req,
}) => {
  try {
    await ActivityLog.create({
      employee_id: employeeId || null,
      action_type: actionType,
      action_description: actionDescription || null,
      target_type: targetType || null,
      target_id: targetId || null,
      metadata: metadata || null,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
    });
  } catch (err) {
    console.error('[activityLogger] Failed to log activity:', err.message);
  }
};

const LOG_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  COURSE_VIEWED: 'COURSE_VIEWED',
  COURSE_LINK_OPENED: 'COURSE_LINK_OPENED',
  COURSE_COMPLETED: 'COURSE_COMPLETED',
  COURSE_ASSIGNED: 'COURSE_ASSIGNED',
  COURSE_ASSIGNMENT_CANCELLED: 'COURSE_ASSIGNMENT_CANCELLED',
  COURSE_CREATED: 'COURSE_CREATED',
  COURSE_UPDATED: 'COURSE_UPDATED',
  COURSE_ARCHIVED: 'COURSE_ARCHIVED',
  EMPLOYEE_ACTIVATED: 'EMPLOYEE_ACTIVATED',
  EMPLOYEE_DEACTIVATED: 'EMPLOYEE_DEACTIVATED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  PROFILE_VIEWED: 'PROFILE_VIEWED',
  ROLE_CREATED: 'ROLE_CREATED',
  ROLE_UPDATED: 'ROLE_UPDATED',
  ROLE_DELETED: 'ROLE_DELETED',
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  BULK_ASSIGNMENT: 'BULK_ASSIGNMENT',
};

module.exports = { logActivity, LOG_ACTIONS };
