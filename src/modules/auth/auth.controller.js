'use strict';

const asyncWrapper = require('../../core/utils/asyncWrapper');
const authService = require('./auth.service');

const IS_PROD = process.env.NODE_ENV === 'production';

function setAccessCookie(res, token) {
	res.cookie('lms_access', token, {
		httpOnly: true,
		secure: IS_PROD,
		sameSite: IS_PROD ? 'strict' : 'lax',
		maxAge: authService.ACCESS_EXPIRY_MS,
		path: '/api',
	});
}

function setRefreshCookie(res, token) {
	res.cookie('lms_refresh', token, {
		httpOnly: true,
		secure: IS_PROD,
		sameSite: IS_PROD ? 'strict' : 'lax',
		maxAge: authService.REFRESH_EXPIRY_MS,
		path: '/api/auth',
	});
}

function clearAllCookies(res) {
	res.clearCookie('lms_access', { path: '/api' });
	res.clearCookie('lms_refresh', { path: '/api/auth' });
}

const microsoftLogin = asyncWrapper(async (req, res) => {
	const authUrl = await authService.getMicrosoftLoginUrl();
	res.json({ authUrl });
});

const microsoftCallback = asyncWrapper(async (req, res) => {
	const result = await authService.handleMicrosoftCallback(req.query.code, req);

	if (result.accessToken) setAccessCookie(res, result.accessToken);
	if (result.refreshToken) setRefreshCookie(res, result.refreshToken);

	return res.redirect(result.redirectTo);
});

const refresh = asyncWrapper(async (req, res) => {
	const result = await authService.refreshAuthSession(req.cookies?.lms_refresh, req);

	if (result.clearCookies) clearAllCookies(res);
	if (result.accessToken) setAccessCookie(res, result.accessToken);
	if (result.refreshToken) setRefreshCookie(res, result.refreshToken);

	res.status(result.status).json(result.body);
});

const sessionStatus = asyncWrapper(async (req, res) => {
	const result = await authService.getSessionStatus(
		req.cookies?.lms_access,
		req.cookies?.lms_refresh,
		req
	);

	if (result.clearCookies) clearAllCookies(res);
	if (result.accessToken) setAccessCookie(res, result.accessToken);
	if (result.refreshToken) setRefreshCookie(res, result.refreshToken);

	return res.status(result.status).json(result.body);
});

const getMe = asyncWrapper(async (req, res) => {
	const result = await authService.getMe(req.user.id);
	return res.status(result.status).json(result.body);
});

const logout = asyncWrapper(async (req, res) => {
	const result = await authService.logout(req.cookies?.lms_refresh, req.user, req);
	if (result.clearCookies) clearAllCookies(res);
	return res.status(result.status).json(result.body);
});

module.exports = { microsoftLogin, microsoftCallback, refresh, sessionStatus, getMe, logout };