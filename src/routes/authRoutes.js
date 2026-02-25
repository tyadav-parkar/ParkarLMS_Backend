'use strict';

const express = require('express');
const router = express.Router();
const { microsoftLogin, microsoftCallback, getMe, logout } = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');
// Public routes — no auth required
router.get('/microsoft/login', microsoftLogin);
router.get('/azure/callback', microsoftCallback);
// Protected routes — require valid JWT
router.get('/me', authMiddleware, getMe);
router.post('/logout', authMiddleware, logout);
module.exports = router;
