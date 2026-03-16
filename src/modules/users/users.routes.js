'use strict';

const express = require('express');
const router = express.Router();
const { getUsers, assignRole } = require('./users.controller');
const { authMiddleware } = require('../../core/middlewares/authMiddleware');
const { requirePermission, requireAnyPermission } = require('../roles/roles.permissions');
const { validateGetUsers, validateAssignRole } = require('./users.validation');

router.get('/', authMiddleware, requireAnyPermission('user_view', 'user_edit'), validateGetUsers, getUsers);
router.post('/assign', authMiddleware, requirePermission('user_edit'), validateAssignRole, assignRole);

module.exports = router;