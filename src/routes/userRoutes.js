'use strict';

const express = require('express');
const router  = express.Router();
const { getUsers, assignRole }       = require('../controllers/userController');
const { authMiddleware }             = require('../middlewares/authMiddleware');
const { requirePermission, requireAnyPermission } = require('../middlewares/roleMiddleware');
const { validateGetUsers, validateAssignRole }     = require('../validations/userValidations');

// GET /api/users — list employees with pagination, search and role filter
router.get('/', authMiddleware, requireAnyPermission('user_view', 'user_edit'), validateGetUsers, getUsers);

// POST /api/users/assign — assign a role to an employee
router.post('/assign', authMiddleware, requirePermission('user_edit'), validateAssignRole, assignRole);

module.exports = router;
