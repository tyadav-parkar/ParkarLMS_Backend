'use strict';

const express = require('express');
const router = express.Router();
const { microsoftLogin, microsoftCallback, refresh, sessionStatus, getMe, logout } = require('./auth.controller');
const { authMiddleware } = require('../../core/middlewares/authMiddleware');

router.get('/microsoft/login', microsoftLogin);
router.get('/azure/callback', microsoftCallback);

router.post('/refresh', refresh);
router.get('/session', sessionStatus);
router.get('/me', authMiddleware, getMe);
router.post('/logout', logout);

module.exports = router;