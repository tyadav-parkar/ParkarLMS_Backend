'use strict';
 
const express = require('express');
const router = express.Router();
const {
    getRoles,
    getPermissions,
    getRole,
    createRole,
    updateRole,
    deleteRole,
} = require('./roles.controller');
const { authMiddleware } = require('../../core/middlewares/authMiddleware');
const { requirePermission, requireAnyPermission } = require('./roles.permissions');
const {
    validateCreateRole,
    validateUpdateRole,
    validateDeleteRole,
    validateGetRoles,
} = require('./roles.validation');
 
router.get('/permissions', authMiddleware, requireAnyPermission('role_view', 'role_edit'), getPermissions);
router.get('/', authMiddleware, requireAnyPermission('role_view', 'role_edit', 'user_view', 'user_edit'), validateGetRoles, getRoles);
router.get('/:id', authMiddleware, requireAnyPermission('role_view', 'role_edit'), getRole);
 
router.post('/', authMiddleware, requirePermission('role_edit'), validateCreateRole, createRole);
router.put('/:id', authMiddleware, requirePermission('role_edit'), validateUpdateRole, updateRole);
router.delete('/:id', authMiddleware, requirePermission('role_edit'), validateDeleteRole, deleteRole);
 
module.exports = router;
 